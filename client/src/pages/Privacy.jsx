import { FiShield, FiEyeOff, FiCpu, FiTrash2 } from "react-icons/fi";
import { Badge } from "../components/ui/badge";
import { Card } from "../components/ui/card";

const points = [
  { icon: FiEyeOff, title: "No recognition", body: "FaceSense never identifies anyone. It detects faces and estimates age band, gender and emotion — it does not match or remember individuals." },
  { icon: FiCpu, title: "On-edge inference", body: "Analysis runs on the machine attached to your camera. Video frames are processed locally and never uploaded." },
  { icon: FiShield, title: "Anonymous aggregates only", body: "The only data that leaves the camera is anonymous, aggregated readings — counts by age band, gender and emotion over time." },
  { icon: FiTrash2, title: "No images stored", body: "No photos, video or biometric templates are saved. There is nothing that can be traced back to a person." },
];

export const Privacy = () => (
  <main className="container max-w-3xl py-16">
    <Badge><FiShield size={12} /> Privacy</Badge>
    <h1 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-5xl">Private by design</h1>
    <p className="mt-4 text-lg text-muted-foreground">
      FaceSense is built to give businesses insight without surveilling people. Here's exactly
      what it does and doesn't do.
    </p>
    <div className="mt-10 grid gap-5 sm:grid-cols-2">
      {points.map((p) => (
        <Card key={p.title} className="p-6">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><p.icon size={18} /></span>
          <h3 className="mt-4 text-lg font-semibold">{p.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
        </Card>
      ))}
    </div>
    <p className="mt-10 text-sm text-muted-foreground">
      Because no personal data is collected, FaceSense helps you stay aligned with privacy
      regulations such as GDPR. For questions, reach us via the contact page.
    </p>
  </main>
);

export default Privacy;
