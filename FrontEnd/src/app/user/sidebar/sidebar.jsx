"use client"
import styles from '@/app/components/sidebar/sidebar.module.css';
import React, { useState, useEffect } from 'react';
import MenuLink from './menuLink/menuLink';
import Image from 'next/image';
import { useCookies } from 'react-cookie';
import { jwtDecode } from 'jwt-decode';
import toast from'react-hot-toast';
import { useLogout } from '@/app/auth/logout/logout';
import {
  MdDashboard,
  MdOutlineSettings,
  MdLogout,
  MdHistory,
  MdAssignmentReturn,
  MdStorage,
} from 'react-icons/md';

const menuItems = [
    {
      title: "Dispay",
      list: [
        {
          title: "Dashboard",
          path: "/user",
          icon: <MdDashboard />,
        },
        {
          title: "Requests",
          path: "/user/requests",
          icon: <MdAssignmentReturn />,
        },
        {
          title: "Equipment",
          path: "/user/equipment",
          icon: <MdStorage />,
        },
        {
          title: "History",
          path: "/user/history",
          icon: <MdHistory />,
        },
      ],
    },
    
    {
      title: "Account",
      list: [
        {
          title: "Settings ",
          path: "/user/settings",
          icon: <MdOutlineSettings />,
        },
       
      ],
    },
  ];

const Sidebar = () => {
    const [cookies, setCookie, removeCookie] = useCookies(['accessToken']);
    const [role, setRole] = useState(null);
    const [firstName, setFirstName] = useState(null);
    const [lastName, setLastName] = useState(null);
    const { handleLogout } = useLogout(); 


    useEffect(() => {
      const token = cookies.accessToken;
      if (token) {
          const decodedToken = jwtDecode(token);
          const userRole = decodedToken.user.role;
          const userFirstName = decodedToken.user.first_name;
          const userLastName = decodedToken.user.last_name;
          const expirationTime = decodedToken.exp * 1000;
          const currentTime = Date.now();
  
          if (expirationTime < currentTime) {
              handleLogout();
          } else {
              setRole(userRole === 'user' ? '' : '');
              setFirstName(userFirstName);
              setLastName(userLastName);
              if (userRole !== 'user') {
                handleLogout();
                toast.error('You are not authorized to access this page');
                return;
              }
          }
      } else {
          handleLogout();
          setFirstName(null);
          setLastName(null);
          setRole(null);
        }
  }, [cookies.accessToken, handleLogout])

useEffect(() => {
  const token = cookies.accessToken;
  if (token) {
      const decodedToken = jwtDecode(token);
      const expirationTime = decodedToken.exp * 1000;
      const currentTime = Date.now();
      if (expirationTime < currentTime) {
          handleLogout();
      }
  }
}, [cookies.accessToken, handleLogout]);

    return(
        <div className={styles.container}>
          <div className={styles.user}>
            <Image className={styles.userImage} src="/user.png" alt="" width="50" height="50" />
            <div className={styles.userDetail}>
            <div className={styles.username}>
              <span className={styles.firstname}>{firstName}</span>{' '}
              <span className={styles.lastname}>{lastName}</span>
              </div>
              <span className={styles.userRole}>{role}</span>
            </div>
          </div>
            <ul className={styles.list}>
                {menuItems.map(cat=>(
                    <li key={cat.title}>
                        <span className={styles.cat}>{cat.title}</span>
                        {cat.list.map(item => (
                          <MenuLink item={item} key={item.title} />
                        ))}
                    </li>
                ))}
            </ul>
            <button className={styles.logout} onClick={handleLogout}>
              <MdLogout/>
              Logout</button>
        </div>
    )
}

export default Sidebar;