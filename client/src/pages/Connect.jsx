import { useState } from "react";
import { FiCopy, FiCheck, FiVideo, FiTerminal, FiKey, FiArrowRight } from "react-icons/fi";
import { API_URL } from "../api";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";

const CodeBlock = ({ code }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-xl border border-border bg-foreground px-4 py-3.5 font-mono text-xs leading-relaxed text-background/90">
        {code}
      </pre>
      <button onClick={copy} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg bg-background/10 text-background/80 hover:bg-background/20" aria-label="Copy">
        {copied ? <FiCheck size={14} /> : <FiCopy size={14} />}
      </button>
    </div>
  );
};

const Step = ({ n, icon: Icon, title, children }) => (
  <Card>
    <CardHeader>
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><Icon size={17} /></span>
        <span className="font-mono text-sm text-muted-foreground">Step {n}</span>
      </div>
      <CardTitle className="mt-1">{title}</CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">{children}</CardContent>
  </Card>
);

export const Connect = () => {
  const ingestUrl = `${API_URL}/api/ingest`;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-secondary/20">
      <div className="container max-w-3xl py-10">
        <Badge><FiVideo size={12} /> Onboarding</Badge>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">Connect a camera</h1>
        <p className="mt-2 text-muted-foreground">
          The FaceSense analyser runs on the machine attached to your camera and streams anonymous
          readings to this dashboard. It takes about three minutes to set up.
        </p>

        <div className="mt-8 space-y-5">
          <Step n={1} icon={FiTerminal} title="Install the analyser">
            <CardDescription>Clone the repo and install the Python dependencies.</CardDescription>
            <CodeBlock code={`cd model
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt`} />
          </Step>

          <Step n={2} icon={FiKey} title="Point it at this dashboard">
            <CardDescription>
              In <span className="font-mono">model/.env</span>, send readings over the authenticated
              ingestion API (so the camera box never holds database credentials). Use the same
              API key your admin set as <span className="font-mono">INGEST_API_KEY</span> on the server.
            </CardDescription>
            <CodeBlock code={`VMS_STORAGE=http
VMS_INGEST_URL=${ingestUrl}
VMS_INGEST_API_KEY=<your-ingest-api-key>`} />
          </Step>

          <Step n={3} icon={FiVideo} title="Start analysing">
            <CardDescription>Run the pipeline against a webcam, a video file, or a CCTV/RTSP stream.</CardDescription>
            <CodeBlock code={`python pipeline.py                       # webcam
python pipeline.py --source file --file clip.mp4
python pipeline.py --source rtsp --rtsp-url rtsp://user:pass@ip:554/stream`} />
            <p className="flex items-center gap-2 pt-1 text-sm text-muted-foreground">
              <FiArrowRight className="text-primary" /> Readings appear on your dashboard within seconds.
            </p>
          </Step>
        </div>

        <Card className="mt-6 p-6">
          <h3 className="text-base font-semibold">Privacy</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            FaceSense recognises no one and stores no images. Faces are analysed on the edge and only
            anonymous, aggregated readings (age band, gender, emotion) ever leave the camera machine.
          </p>
        </Card>
      </div>
    </main>
  );
};

export default Connect;
