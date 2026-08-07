// TMA has no dedicated in-app page — enquiries go straight to WhatsApp instead.
const TMA_WHATSAPP_NUMBER = '2348036152670'; // +234 803 615 2670
const TMA_WHATSAPP_MESSAGE = 'I will like to make enquiries for TMA';

export const TMA_WHATSAPP_URL = `https://wa.me/${TMA_WHATSAPP_NUMBER}?text=${encodeURIComponent(TMA_WHATSAPP_MESSAGE)}`;
