import {useState} from "react";
import {useNavigate } from "react-router-dom";
import { useAuth } from "../store/auth";
import { toast } from "react-toastify";
import '../index.css';
export const Login = () =>{
    const [user,setUser]=useState({
        username:"",
        password:"",
    });
    const navigate = useNavigate();
    const {storeTokenInLS} = useAuth();



   const handleInput =  (e) => {
    let name = e.target.name;
    let value = e.target.value;


    setUser({
        ...user,
        [name]:value,
    })
   }

   const handleSubmit = async (e) => {
    e.preventDefault();
    try {
        const response = await fetch(`http://localhost:5000/api/auth/login`,{
     method :"POST",
     headers :{
        "Content-Type":"application/json",
     },
     body: JSON.stringify(user),
    });
    const res_data = await response.json();
    console.log("login form ",response); 
    if(response.ok){

        
    //   console.log("res from server",res_data);
      storeTokenInLS(res_data.token);
        alert("successfull login");
      setUser({
      username:"",
      password:""});
      toast.success("Login successful");
      navigate("/");
    }
    else{
        toast.error(res_data.extraDetails ? res_data.extraDetails : res_data.message);
      }
    
    } catch (error) {
        console.log(error);
    }
    console.log(user);
    
   };

    return (<>
        <section>
            <main>
                <div className="section-registration">
                    <div className="container grid gird-two-cols">
                        <div className="registration-image">
                            <img src ="/images/login.jpg" 
                            alt="lets fill the login form"
                            width="500" height="500" 
                            />
                        </div> 
                         <div className="registration-form">
                           <h1 className="main-heading mb-3">Login form</h1> 
                           <br/>
                           <form onSubmit={handleSubmit}>
                            <div>
                    
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
                            <button type="submit" className="btn btn-submit">login</button>
                           </form>
                
                         </div>
                    </div>
                </div>
            </main>
        </section>
        </>);

};