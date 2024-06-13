import { NavLink } from "react-router-dom";
import { Analytics } from "../components/Analytics";
import '../index.css';

export const About = () => {
  return (
    <>
      <main>
        <section className="section-hero">
          <div className="container grid grid-two-cols">
            <div className="hero-content">
              <p>Welcome to our Cutting-Edge Visitor Recognition and Analytics System</p>
              <h1>Why Choose Us?</h1>
             
              <p>
                <b>Customization:</b> Recognizing the uniqueness of each business,
                our system is tailored to suit your specific requirements,
                offering customizable features and functionalities.
              </p>
              <p>
                <b>Customer-Centric Approach:</b> Your satisfaction is our top
                priority. We provide exceptional support to address any
                queries or concerns, ensuring a seamless experience.
              </p>
              <p>
                <b>Data Security: </b>Rest assured, your data is safeguarded through
                robust encryption methods, ensuring the confidentiality and
                integrity of your sensitive information.
              </p>
              <p>
                <b>Accurate Insights:</b> Benefit from precise analysis of visitor
                demographics, including age, gender, and emotions, enabling
                you to understand your audience better and tailor your
                services accordingly.
              </p>
              <p>
                <b>Intuitive Dashboard:</b> Our system offers comprehensive
                visualization tools, presenting captured data in easy-to-
                interpret charts and graphs, empowering you to make informed
                decisions.
              </p>
            
              <div className="btn btn-group">
                <NavLink to="/contact">
                  <button className="btn"> Connect Now</button>
                </NavLink>
                <button className="btn secondary-btn">Learn More</button>
              </div>
            </div>
            <div className="hero-image">
              <img src="/images/big.jpg" alt="home images"  />
            </div>
          </div>
        </section>
      </main>

      {/* second section */}
      <Analytics />
    </>
  );
};
