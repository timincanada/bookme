import { configuredOAuthProviders } from "@/lib/oauth";
import { RegisterClient } from "./RegisterClient";

export default function RegisterPage() {
  return <RegisterClient providers={configuredOAuthProviders()} />;
}
