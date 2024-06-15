import "./Footer.css";

export const Footer = () => {
    return (
        <footer  >
            <div className="footer">
            <div className="footer-column">
                <h2>FaceSense</h2><br />
                <p>Contact Info: +91 9898233268</p>
                <p>Email: statmodeller@gmail.com</p>
                <p>Address: SF-5, Earth Icon, New VIP Rd, Purushottam Nagar, Kishanwadi, Vadodara, Gujarat 390019</p>
            </div>
            
            <div className="footer-column">
                <br /><br /><br />
                <h3>GLOSSARY</h3>
                <ul className="footer-links">
                    <li><a href="/">Home</a></li>
                    <li><a href="/about">About Us</a></li>
                    <li><a href="/register">Register</a></li>
                    <li><a href="/login">Login</a></li>
                    <li><a href="/contact">Contact</a></li>
                </ul>
            </div>
            <div className="footer-column"><br /><br /><br />
                <h3>OUR MOTTO</h3>
                <p>Exploring the rich tapestry of human expression, our advanced technology decodes intricate details, offering a panoramic view of insights that shape informed strategies.</p>
            </div>
            </div>
           <center> <p>© 2024 FaceSense. All rights reserved.</p></center><br /><br />
        </footer>
    );
};
