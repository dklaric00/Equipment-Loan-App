"use client";
import styles from './page.module.css'
import Image from "next/image";
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from "@hookform/resolvers/yup";
import { useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa'; 
import { useRouter } from "next/navigation";
import axios from 'axios';


const LoginPage = (data) => {
    const router = useRouter();

    const [showPassword, setShowPassword] = useState(false);

    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    const schema = yup.object().shape({
        username: yup.string().required("Username is required"),
        password: yup.string().required("Password is required"),
    });
    
    const{ register, handleSubmit, formState:{errors },} = useForm({
        resolver: yupResolver(schema)
    });

    const onSubmit = (data) => {
        axios
        .post(process.env.NEXT_PUBLIC_BASE_URL + "/login", data)
        .then((response) => {
            console.log("Logged in successfully!");
            router.push("/admin");
        })
        .catch((error) => {
            console.error("Login error:", error.response.data.message);
            alert("Invalid username or password");
        });
    };

    return(
        <div className={styles.container}>
            <link rel="icon" href="/favicon.ico" /> 
            
            <div className={styles.bgi}>
            <Image 
                src="/keyboard.avif" alt="" layout="fill" 
                objectFit='cover' />
            
            <form onSubmit={handleSubmit(onSubmit)} action="" className={styles.form}>
                <div className={styles.start}>
                    <span className={styles.title}>Equipment-Loan</span>
                    <span className={styles.desc} >Prijavi se!</span> 
                </div>
                

                <label className={styles.username}>Korisničko ime:
                {/* <p>{errors.username?.message}</p>*/}
                <input type="text" className={styles.autofill} placeholder="Unesite email ili korisničko ime" {...register("username")} autoComplete="off" /></label>  

                <label className={styles.password}>Lozinka:
                    <div className={styles.passwordInputContainer}>
                        <input 
                            type={showPassword ? "text" : "password"}
                            placeholder="Unesite lozinku" 
                            {...register("password")}  
                            autoComplete="off"
                        />
                        <span className={styles.passwordToggle} onClick={togglePasswordVisibility}>
                            {showPassword ? <FaEyeSlash /> : <FaEye />}
                        </span>
                    </div>
                </label>

                <div className={styles.btn}>
                      
                    <div className={styles.box}>
                        <label className={styles.checkbox}> 
                        <input type="checkbox" name=""/>Zapamti me</label>
                        <a href="/mail.jsx" className={styles.forgot}>Zaboravili ste lozinku?</a>
                    </div>
                    
                    <button type="submit">Prijava</button>
                </div>   
            </form> 
            </div>
        </div> 
    );
};

export default LoginPage;
