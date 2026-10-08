/**
 * WhatsApp Click-to-Chat Floating Button
 *
 * Opens a short guided questionnaire, then deep-links into WhatsApp
 * with a prefilled message and captures the lead in the admin inbox.
 */
import { useState } from "react";
import { useLocation } from "react-router-dom";
import WhatsAppQuestionnaire from "./WhatsAppQuestionnaire";
import DraggableControl from "./ui/DraggableControl";

const LiveChatButton = () => {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  // Signed in surfaces have their own bottom tab bar; the bubble would sit on it.
  if (
    pathname.startsWith("/portal") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/join") ||
    pathname.startsWith("/claim") ||
    // A care offer has its own WhatsApp link and a Back and Next bar here.
    pathname.startsWith("/care/offer")
  ) return null;

  return (
    <>
      <DraggableControl storageKey="mc_whatsapp_pos" defaultCorner="bottom-right">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Chat with us on WhatsApp"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-black/20 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2 md:h-16 md:w-16"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 32 32"
            className="h-7 w-7 md:h-8 md:w-8"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.746.315-.688.645-1.032 1.318-1.06 2.264v.114c-.015.99.472 1.977 1.017 2.78 1.23 1.82 2.506 3.41 4.554 4.34.616.287 2.035.888 2.722.888.817 0 2.15-.515 2.478-1.318.13-.302.158-.624.158-.945 0-.4-1.69-1.747-2.62-1.747zM16.005 26.005c-1.85 0-3.69-.52-5.31-1.49l-3.71.98.985-3.61a10.001 10.001 0 0 1-1.585-5.42c0-5.522 4.488-10.01 10.01-10.01 5.522 0 10.01 4.488 10.01 10.01 0 5.522-4.488 10.01-10.01 10.01l-.39-.47z" />
          </svg>
        </button>
      </DraggableControl>
      <WhatsAppQuestionnaire open={open} onOpenChange={setOpen} />
    </>
  );
};

export default LiveChatButton;
