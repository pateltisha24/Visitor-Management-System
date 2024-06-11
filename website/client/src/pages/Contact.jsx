import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../store/auth";

const defaultConactFormData = {
  
};
export const Contact = () => {
  const [contact, setContact] = useState(
   {
    username: "",
    email: "",
    message: "",

   }
  );
  const navigate = useNavigate();
  //  const [userData ,setUserData]=useState(true);
  //  const {user} = useAuth();

  //  if(userData && user){
  //   setContact({
  //     username:user.username,
  //     email: user.email,
  //     message:"",
  //   });
  //   userData(false);j
  //  }
  // lets tackle our handleInput
  const handleInput = (e) => {
    const name = e.target.name;
    const value = e.target.value;

    setContact({
      ...contact,
      [name]: value,
    });
  };

  // // handle fomr getFormSubmissionInfo
  // const handleSubmit = async (e) => {
  //   e.preventDefault();

  //   console.log(contact);
  //   try {
  //     const response = await fetch(`http://localhost:5000/api/form/contact`,{
  //    method :"POST",
  //    headers :{
  //       "Content-Type":"application/json",
  //    },
  //    body: JSON.stringify(contact),
  //   });
    
  //   if(response.ok){
  //     const res_data = await response.json();
  //     console.log("res from server",res_data);
  //     storeTokenInLS(res_data.token);
  //     setContact({ defaultConactFormData});

  //     navigate("/");
  //     const result = await response.json();
  //   console.log(result);
  //   console.log(response);
  //   }
    
  //   } catch (error) {
  //     console.log("contact" , error);
  //   }
  // };
  const handleSubmit = async (e) => {
    e.preventDefault();
  
    try {
      const response = await fetch("http://localhost:5000/api/form/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(contact),
      });
  
      if (response.ok) {
        const c_data = await response.json();
        console.log("res from server", c_data);
        // Assuming `storeTokenInLS` and `navigate` are defined elsewhere
        storeTokenInLS(c_data.token);
        setContact({
          username: "",
  email: "",
  message: "",
        });
        navigate("/About");
      } else {
        // Handle non-successful response (e.g., server error)
        console.error("Server error:", response.statusText);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };
  

  return (
    <>
      <section className="section-contact">
        <div className="contact-content container">
          <h1 className="main-heading">Contact Us</h1>
        </div>
        {/* contact page main  */}
        <div className="container grid grid-two-cols">
          <div className="contact-img">
            <img src="/images/ava.jpg" alt="we are always ready to help" />
          </div>

          {/* contact form content actual  */}
          <section className="section-form">
            <form onSubmit={handleSubmit}>
              <div>
                <label htmlFor="username">username</label>
                <input
                  type="text"
                  name="username"
                  id="username"
                  autoComplete="off"
                  value={contact.username}
                  onChange={handleInput}
                  required
                />
              </div>

              <div>
                <label htmlFor="email">email</label>
                <input
                  type="email"
                  name="email"
                  id="email"
                  autoComplete="off"
                  value={contact.email}
                  onChange={handleInput}
                  required
                />
              </div>

              <div>
                <label htmlFor="message">message</label>
                <textarea
                  name="message"
                  id="message"
                  autoComplete="off"
                  value={contact.message}
                  onChange={handleInput}
                  required
                  cols="30"
                  rows="6"
                ></textarea>
              </div>

              <div>
                <button type="submit">submit</button>
              </div>
            </form>
          </section>
        </div>

        <section className="mb-3">
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3782.2613173278896!2d73.91411937501422!3d18.562253982539413!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc2c147b8b3a3bf%3A0x6f7fdcc8e4d6c77e!2sPhoenix%20Marketcity%20Pune!5e0!3m2!1sen!2sin!4v1697604225432!5m2!1sen!2sin"
            width="100%"
            height="450"
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          ></iframe>
        </section>
      </section>
    </>
  );
};