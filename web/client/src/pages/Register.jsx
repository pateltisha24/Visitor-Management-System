import {useState} from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../store/auth";
import { toast } from "react-toastify";
import '../index.css';
import "react-toastify/dist/ReactToastify.css";
export const Register = () =>{
    const [user,setUser]= useState({
      organisation :"",
        username:"",
        email:"",
        password:"",
    });
 
    const navigate = useNavigate();
    const {storeTokenInLS} = useAuth();
    const handleInput =(e) => {
        console.log(e);
        let name = e.target.name;
        let value = e.target.value;
        setUser({
            ...user,
            [name]:value,

        });
     
    };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log(user);
    try {
      const response = await fetch("https://server-zeta-beige.vercel.app/api/auth/register",{
     method :"POST",
     headers :{
        "Content-Type":"application/json",
     },
     body: JSON.stringify(user),
    });
    const res_data = await response.json();
    // console.log("res from server",res_data.extraDetails);
    if(response.ok){

      storeTokenInLS(res_data.token);
      setUser({organisation :"",
      username:"",
      email:"",
      password:""});
      toast.success("Registeration successful");
      navigate("/login");
    }
    else{
      toast.error(res_data.extraDetails ? res_data.extraDetails : res_data.message);
    }
    
    } catch (error) {
      console.log("register" , error);
    }
    
  };


    return (<>
    <section>
        <main>
            <div className="section-registration">
                <div className="container grid gird-two-cols">
                    <div className="registration-image">
                        <img src ="/images/res.png" 
                        alt="a girl is trying to do registration"
                        width="400" height="500" 
                        />
                    </div> 
                     <div className="registration-form">
                       <h1 className="main-heading mb-3">Registration</h1> 
                       <br/>
                       <form onSubmit={handleSubmit}>
                        <div>
                        <label htmlFor="organisation">organization name</label>
                            <input 
                              type="text"
                              name="organisation"
                              placeholder="organization name"
                              id="organisation"
                              required
                              autoComplete="off"
                              value={user.organisation}
                              onChange={handleInput}
                            />
                            <label htmlFor="username">username</label>
                            <input 
                              type="text"
                              name="username"
                              placeholder="username"
                              id="username"
                              required
                              autoComplete="off"
                              value={user.username}
                              onChange={handleInput}
                            />
                             <label htmlFor="email">email</label>
                            <input 
                              type="email"
                              name="email"
                              placeholder="enter your email"
                              id="email"
                              required
                              autoComplete="off"
                              value={user.email}
                              onChange={handleInput}
                            />
                            <label htmlFor="password">password</label>
                            <input 
                              type="password"
                              name="password"
                              placeholder="password"
                              id="password"
                              required
                              autoComplete="off"
                              value={user.password}
                              onChange={handleInput}
                            />
                        </div>
                        <button type="submit" className="btn btn-submit">Register Now </button>
                       </form>
            
                     </div>
                </div>
            </div>
        </main>
    </section>
    </>);
};