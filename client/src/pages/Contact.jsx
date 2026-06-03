import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api";
import { toast } from "react-toastify";
import { FiArrowRight, FiPhone, FiMail } from "react-icons/fi";
import { Button } from "../components/ui/button";
import { Input, Textarea, Label } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Card } from "../components/ui/card";

export const Contact = () => {
  const [contact, setContact] = useState({ username: "", email: "", message: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleInput = (e) => setContact({ ...contact, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await apiFetch("/api/form/contact", {
        method: "POST",
        body: JSON.stringify(contact),
      });
      if (response.ok) {
        setContact({ username: "", email: "", message: "", phone: "" });
        toast.success("Message sent — we'll be in touch");
        navigate("/about");
      } else {
        toast.error("Message could not be sent. Please try again.");
      }
    } catch (error) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const channels = [
    { icon: FiPhone, label: "Phone", value: "+1 (857) 399-5023" },
    { icon: FiMail, label: "Email", value: "pateltisha24@gmail.com" },
  ];

  return (
    <main className="container py-16">
      <div className="max-w-2xl">
        <Badge>Contact</Badge>
        <h1 className="mt-4 text-balance font-display text-4xl font-bold tracking-tight sm:text-5xl">
          Let's talk about your space
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Questions about deployment, cameras or insights? Send a note and the team will get back to you.
        </p>
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-4">
          {channels.map((c) => (
            <Card key={c.label} className="flex items-center gap-4 p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <c.icon size={18} />
              </span>
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">{c.label}</div>
                <div className="font-medium">{c.value}</div>
              </div>
            </Card>
          ))}
          <Card className="p-6">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Prefer email? Drop us a line and we'll reply within one business day with next steps for your space.
            </p>
          </Card>
        </div>

        <Card className="p-7 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="username">Name</Label>
                <Input id="username" name="username" placeholder="Your name" required value={contact.username} onChange={handleInput} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" placeholder="Contact number" required value={contact.phone} onChange={handleInput} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="you@company.com" required value={contact.email} onChange={handleInput} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea id="message" name="message" placeholder="Tell us about your space and what you'd like to measure…" required value={contact.message} onChange={handleInput} />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? "Sending…" : <>Send message <FiArrowRight /></>}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
};
