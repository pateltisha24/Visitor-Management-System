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
                        <p>we are the world Best IT Company </p>
                        <h1>Welcome to our Company</h1>
                        <p>
                            Are you ready to take your business to the next level with cutting-edge IT solution ?
                            Look no further!With three idiors,We specialize in providing innovative IT services 
                            and solutions tailored to meet your unique needs.
                        </p>
                        <div className="btn btn-group">
                            <a href="/contact">
                                <button className="btn">connect now</button>
                            </a>
                            <a href="/service">
                                <button className="btn secondary-btn">learn more</button>
                            </a>
                        </div>
                    </div>
                   
                <div className="hero-image">
                    <img src="/images/new.jpg" alt="home images" width="500" heigth="500" />
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
                    <img src="/images/new.jpg" alt="home images" width="800" heigth="800" />
                </div>
                    <div className="hero-content">
                   
                        <p>we are here to help you </p>
                        <h1>Get Started Today</h1>
                        <p>
                            Are you ready to take your business to the next level with cutting-edge IT solution ?
                            Look no further!With three idiors,We specialize in providing innovative IT services 
                            and solutions tailored to meet your unique needs.
                        </p>
                        <div className="btn btn-group">
                            <a href="/contact">
                                <button className="btn">connect now</button>
                            </a>
                            <a href="/services">
                                <button className="btn secondary-btn">learn more</button>
                            </a>
                        </div>
                    </div>
                   
                
                </div>
                
            </section>
        </>
    );
};