// import { Analytics } from "./Analytics";
import { Analytics } from "../components/Analytics";
import '../index.css';
export const Home = () =>{
    return (
        <>
        <main>
            <section className="section-hero">
                <div className="container grid grid-two-cols">
                    <div className="hero-content">
                        <p>Welcome to our Cutting-Edge Visitor Recognition and Analytics System</p>
                        <h1>Unlock Insights with Facial Recognition and Advanced Analytics</h1>
                        <p>
                            Are you ready to take your business to the next level with cutting-edge IT solutions?
                            Look no further! With our advanced technology, we specialize in providing innovative and comprehensive analysis of facial features including age, gender, emotion tailoring your needs and enabling you to understand your visitors on deeper level.
                        </p>
                        <div className="btn btn-group">
                            <a href="/contact">
                                <button className="btn">Connect Now</button>
                            </a>
                            <a href="/service">
                                <button className="btn secondary-btn">Learn More</button>
                            </a>
                        </div>
                    </div>
                   
                <div className="hero-image">
                    <img src="/images/new.jpg" alt="home images"  />
                </div>
                </div>
                
            </section>
        </main>

        {/* second section */}
          <Analytics/>
        {/* third section */}
        <section className="section-hero">
                <div className="container grid grid-two-cols">
                <div className="hero-image">
                    <img src="/images/new.jpg" alt="home images"  />
                </div>
                    <div className="hero-content">
                   
                        <p>Unlock the Power of Data</p>
                        <h1>Analyze, Visualize, and Optimize</h1>
                        <p>
                            With our advanced analytics platform, we help you make data-driven decisions. 
                            Analyze captured data with intuitive charts and graphs, enabling you to understand visitor behavior, trends, and preferences better.
                        </p>
                        <div className="btn btn-group">
                            <a href="/contact">
                                <button className="btn">Connect Now</button>
                            </a>
                            <a href="/services">
                                <button className="btn secondary-btn">Learn More</button>
                            </a>
                        </div>
                    </div>
                   
                
                </div>
                <br /><br /><br /><br />
                
            </section>
        </>
    );
};
