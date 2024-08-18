const asyncHandler = require("express-async-handler");
const Joi = require("joi");
/** Models **/
const User = require("../models/userModel");
const Equipment = require("../models/equipmentModel");
const Request = require("../models/userEquipmentModel");
const EquipmentHistory = require("../models/equipmentHistoryModel");
/** Constants **/
const { UserEquipmentStatus } = require("../constants");
/** Notifications **/
const Notification = require('../models/notificationModel');

/**** Requests managed by ADMIN ****/

/**
 * @desc Get all Active requests (Users + Equipment)
 * @route GET /api/admin/
 * @access private
 */
const getAllActiveRequests = asyncHandler(async (req, res) => {

    // Find all active requests - each user's assigned equipment
    const requests = await Request.find({ request_status: UserEquipmentStatus.ACTIVE }).sort({ assign_date: 1 });

    // Check if requests are found
    if (!requests || requests.length === 0) {
        res.status(404);
        throw new Error("No active equipment assigned!");
    }

    // Iterate through all requests and fetch user information
    for (const request of requests) {
        const user = await User.findById(request.user_id);
        if (user) {
            request.user_info = {
                first_name: user.first_name,
                last_name: user.last_name,
                username: user.username
            };
        }

        // Find equipment information based on equipment_id
        const equipment = await Equipment.findById(request.equipment_id);
        // If equipment is found, add equipment information to the request
        if (equipment) {
            request.equipment_info = {
                name: equipment.name,
                serial_number: equipment.serial_number
            };
        }
    }

    // Add user_info and equipment_info at the end of each request
    const response = requests.map(request => {
        return {
            ...request._doc,
            user_info: request.user_info,
            equipment_info: request.equipment_info,
        };
    });

    res.status(200).json(response);
});

/**
 * @desc Get all Pending requests (Users + Equipment)
 * @route GET /api/admin/requests
 * @access private
 */
const getAllPendingRequests = asyncHandler(async (req, res) => {
    // Find all requests that are in status "pending"
    const requests = await Request.find({ request_status: UserEquipmentStatus.PENDING }).sort({ assign_date: 1 });

    // Check if requests are found
    if (!requests || requests.length === 0) {
        res.status(404);
        throw new Error("There are no pending requests!");
    }

    // Iterate through all requests and fetch user and equipment information
    for (const request of requests) {
        const user = await User.findById(request.user_id);
        if (user) {
            request.user_info = {
                first_name: user.first_name,
                last_name: user.last_name,
                username: user.username
            };
        }

        // Find equipment information based on equipment_id
        const equipment = await Equipment.findById(request.equipment_id);
        // If equipment is found, add equipment information to the request
        if (equipment) {
            request.equipment_info = {
                name: equipment.name,
                full_name: equipment.full_name,
                serial_number: equipment.serial_number,
                quantity: equipment.quantity,
                request_status: equipment.request_status
            };
        }
    }

    // Add user_info and equipment_info at the end of each request
    const response = requests.map(request => {
        return {
            ...request._doc,
            user_info: request.user_info,
            equipment_info: request.equipment_info,
        };
    });

    res.status(200).json(response);
});

/**
 * @desc Deactivate request for assigned equipment (returned)
 * @route PATCH /api/admin/:id
 * @access private
 */
const deactivateRequest = asyncHandler(async (req, res) => {
    const request = await Request.findById(req.params.id);
    const unassign_quantity = req.body.unassign_quantity;

    if (!request) {
        res.status(404);
        throw new Error("Request not found!");
    }

    const deactivateRequestSchema = Joi.object({
        unassign_quantity: Joi.number().integer().min(1).required()
    });

    const { error } = deactivateRequestSchema.validate(req.body, { abortEarly: false });
    if (error) {
        const errorMessages = error.details.map(detail => detail.message);
        res.status(400);
        throw new Error(errorMessages.join(', '));
    }

    const equipment = await Equipment.findById(request.equipment_id);

    if (!equipment) {
        res.status(404);
        throw new Error("Equipment not found!");
    }

    if (unassign_quantity > request.quantity) {
        res.status(400);
        throw new Error("Invalid quantity for unassigning equipment!");
    }

    const newHistory = new EquipmentHistory({
        user_id: request.user_id,
        equipment_id: request.equipment_id,
        unassigned_quantity: unassign_quantity,
        unassign_date: new Date(),
        return_status_request: UserEquipmentStatus.RETURNED,
    });
    await newHistory.save();

    request.quantity -= unassign_quantity;

    // Notification messages
    const notificationMessage = request.quantity === 0
        ? `Equipment ALL RETURNED: ${unassign_quantity} → ${equipment.name}`
        : `Equipment RETURNED: ${unassign_quantity} → ${equipment.name}`;

    // Create and save the notification in the database
    const notification = new Notification({
        user_id: request.user_id,
        message: notificationMessage,
        createdAt: new Date(),
    });
    await notification.save()

    if (request.quantity === 0) {
        request.request_status = UserEquipmentStatus.INACTIVE;
        request.return_status_request = UserEquipmentStatus.RETURNED;

        await Request.deleteOne({ _id: request._id });

        equipment.quantity += unassign_quantity;
        await equipment.save();

        // Emit notification for returning all equipment to the specific USER
        if (req.io) {
            req.io.to(request.user_id.toString()).emit('equipmentReturned', notification);
        }

        return res.status(200).json({
            message: `User has returned ALL EQUIPMENT. Request deleted.`,
        });
    }

    equipment.quantity += unassign_quantity;
    await equipment.save();

    const updatedRequest = await request.save();

    // Emit notification for partial return of equipment to the specific USER
    if (req.io) {
        req.io.to(request.user_id.toString()).emit('equipmentReturned', notification);
    }

    res.status(200).json({
        message: `Request status updated to RETURNED (${unassign_quantity} → ${equipment.name}).`,
        request: updatedRequest
    });
});

/**
 * @desc Update request status (Accept or Deny)
 * @route PATCH /api/admin/requests/:id
 * @access private
 */
const acceptOrDenyRequest = asyncHandler(async (req, res) => {
    const { request_status } = req.body;
    const requestId = req.params.id;
    // Find the request by ID
    const request = await Request.findById(req.params.id);

    // Check if the request is found
    if (!request) {
        res.status(404);
        throw new Error("Request not found!");
    }

    const equipment = await Equipment.findById(request.equipment_id);
    if (!equipment) {
        res.status(404);
        throw new Error("Equipment not found!");
    }

    const equipmentDetails = {
        name: equipment.name,
        serial_number: equipment.serial_number,
    };

    // Update request status based on the status sent in the request body
    // If request status is "active", assign equipment to user
    // If request status is "denied", delete request
    if (request_status === 'active') {

        request.request_status = UserEquipmentStatus.ACTIVE;
        request.assign_date = new Date();

        equipment.quantity -= request.quantity;
        await equipment.save();
        await request.save();

        res.status(200).json({
            message: "Request activated successfully.",
            equipment: equipmentDetails,
        });
    } else if (request_status === 'denied') {
        if (request.request_status === UserEquipmentStatus.DENIED) {
            return res.status(400).json({ message: "Request is already denied!" });
        }

        // const unassigned_quantity = request.quantity;

        // const newHistory = new EquipmentHistory({
        //     user_id: request.user_id,
        //     equipment_id: request.equipment_id,
        //     unassigned_quantity: unassigned_quantity,
        //     unassign_date: new Date(),
        //     return_status_request: UserEquipmentStatus.DENIED,
        // });
        // // Save changes to database
        // await newHistory.save();

        // Delete the request from the Request collection
        await Request.findByIdAndDelete(requestId);

        res.status(200).json({
            message: "Equipment request DENIED and DELETED successfully.",
            equipment: equipmentDetails,
        });
    } else {
        res.status(400);
        throw new Error("Invalid status!");
    }
});

/**
 * @desc Get history for RETURNED equipment
 * @route GET /api/admin/equipmentHistory
 * @access private
 */
const getEquipmentHistory = asyncHandler(async (req, res) => {
    // Execute a query to the database to retrieve unassigned equipment history
    const historyData = await EquipmentHistory.find({}).sort({ unassign_date: -1 });

    // Check if equipment history is found
    if (!historyData || historyData.length === 0) {
        res.status(404);
        throw new Error("Equipment history not found!");
    }

    // Iterate through all requests and fetch equipment and user information
    for (const history of historyData) {
        // Fetch equipment information
        const equipment = await Equipment.findById(history.equipment_id);
        if (equipment) {
            history.equipment_info = {
                name: equipment.name,
                serial_number: equipment.serial_number,
            };
        }

        // Fetch user information
        const user = await User.findById(history.user_id);
        if (user) {
            history.user_info = {
                first_name: user.first_name,
                last_name: user.last_name,
                username: user.username,
            };
        }
    }

    // Format the response
    const response = historyData.map(history => {
        return {
            ...history._doc,
            equipment_info: history.equipment_info,
            user_info: history.user_info
        };
    });

    res.status(200).json(response);
});


/**
 * @desc Delete request from History
 * @route DELETE /api/admin/equipmentHistory/:id
 * @access private
 */
const deleteRequest = asyncHandler(async (req, res) => {
    const history = await EquipmentHistory.findById(req.params.id);
    try {
        if (!history) {
            res.status(404);
            throw new Error("Request not found!");
        }

        // Check if the status of the request is "returned"
        if (history.return_status_request === UserEquipmentStatus.RETURNED) {
            // Delete request from database
            await EquipmentHistory.findByIdAndDelete(req.params.id);
            res.status(200).json({ message: "Request deleted successfully." });
        } else {
            res.status(400);
            throw new Error("Request status is not 'RETURNED'!");
        }

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = {
    getAllActiveRequests,
    getAllPendingRequests,
    deactivateRequest,
    acceptOrDenyRequest,
    getEquipmentHistory,
    deleteRequest
};