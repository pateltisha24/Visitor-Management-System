import { FiShield, FiEyeOff, FiCpu, FiTrash2 } from "react-icons/fi";
import { Badge } from "../components/ui/badge";
import { Card } from "../components/ui/card";

const points = [
  { icon: FiEyeOff, title: "No recognition", body: "FaceSense never identifies anyone. It detects faces and estimates age band, gender and emotion. Same-day re-identification (on by default, and can be switched off) compares faces in memory only, so a visitor who leaves and comes back isn't counted twice; it is wiped at the end of each day. A return is recorded only as a time and a camera." },
  { icon: FiCpu, title: "On-edge inference", body: "Analysis runs on the machine attached to your camera. Video is processed locally. If you turn on a camera's optional live preview, its annotated feed is relayed to signed-in dashboard viewers while they watch, and is never recorded." },
  { icon: FiShield, title: "Anonymous aggregates only", body: "Apart from the optional live preview, the only data that leaves the camera is anonymous readings: age band, gender and emotion, with a timestamp and camera name." },
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
