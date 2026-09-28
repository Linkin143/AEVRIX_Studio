import Link from "next/link";
import { Compass } from "lucide-react";
export default function NotFound() { return <div className="panel empty"><Compass size={40}/><h2>That workspace does not exist</h2><p>Return to the creator or browse your generations.</p><Link href="/" className="button primary">Back to Create</Link></div>; }
