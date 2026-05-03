import { createFileRoute } from "@tanstack/react-router";
import { ChatApp } from "@/components/Chat";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <>
      <ChatApp />
      <Toaster theme="dark" />
    </>
  );
}
