import { NavLink } from "react-router-dom";
import { Analytics } from "../components/Analytics";
import '../index.css';

export const About = () => {
  return (
    <>
      <main>
        <section className="section-hero"><br /><br /><br />
          <div className="herotop">
          <p>Welcome to our Cutting-Edge Visitor Recognition and Analytics System</p><br />
          <h1>Our Mission</h1>

          <p>
            Our mission is to revolutionize how businesses harness visitor data to drive growth
            and enhance customer satisfaction. We are committed to developing cutting-edge technologies
            that not only capture age, gender, and emotional insights but also translate these data points
            into actionable strategies that propel your business forward.

          </p><br /><br /><br /><br /><br />
          </div>
          <div className="container grid grid-two-cols">
            <div className="hero-content">

              <h1>What we offer?</h1>
              <p>
                <b>State-of-the-Art Visitor Recognition Systems:</b>Our systems leverage the latest
                advancements in computer vision and artificial intelligence to accurately detect and
                analyze visitor demographics and emotions. From retail stores and hospitality venues
                to educational institutions and healthcare facilities, our solutions are tailored to meet
                the unique needs of diverse industries.

              </p>
              <p>
                <b>Comprehensive Data Insights:</b>We go beyond traditional analytics by providing comprehensive
                data insights that enable you to understand customer behaviour patterns, optimize operational
                efficiency, and tailor marketing strategies. By visualizing data through intuitive charts and
                reports, we empower you to uncover trends, make data-driven decisions, and stay ahead in a
                competitive landscape.

              </p>
              <p>
                <b>Customizable Solutions:</b>Every business is unique, and so are our solutions.
                Whether you need to enhance customer engagement, improve service delivery,
                or enhance security protocols, our customizable systems are designed to adapt and scale
                according to your specific requirements.

              </p>
            </div>
            <div className="hero-image">
              <img src="/images/big.jpg" alt="home images" />
            </div>
          </div>
          <div className="container grid grid-two-cols">
            <div className="hero-image">
              <img src="/images/abuuu.jpg" alt="home images" />
            </div>
            <div className="hero-content">
              <h1>Why Choose Us?</h1>

              <p>
                <b>Expertise and Innovation:</b>Backed by a team of skilled professionals and
                innovators, we continuously push the boundaries of technology to deliver cutting-edge
                solutions that exceed industry standards.

              </p>
              <p>
                <b>Customer-Centric Approach:</b>We prioritize your success and satisfaction. Our
                dedicated support team ensures seamless integration, ongoing support, and training to
                maximize the value of our solutions.

              </p>
              <p>
                <b>Data Security:</b>Rest assured, your data is safeguarded through
                robust encryption methods, ensuring the confidentiality and
                integrity of your sensitive information.
              </p>

              <h1>Get Started Today</h1>

              <p>
                Join leading businesses and organizations worldwide who trust FaceSense for innovative
                visitor recognition solutions. Contact us today to schedule a consultation and discover how our advanced systems can
                transform your operations, elevate customer experiences, and drive growth.
              </p>

              <div className="btn btn-group">
                <NavLink to="/contact">
                  <button className="btn"> Connect Now</button>
                </NavLink>
                <button className="btn secondary-btn">Learn More</button>
              </div>
            </div>

          </div>
        </section>
      </main>

      {/* second section */}
      <Analytics />
    </>
  );
};
