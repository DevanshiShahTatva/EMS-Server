import Event from "../models/event.model";

interface Intent {
  name: string;
  confidence?: number;
}

interface Entity {
  [key: string]: { value: string; role?: string }[];
}

interface TicketType {
  name: string;
  description: string;
}

interface Ticket {
  type: TicketType;
  price: number;
}

interface EventType {
  title: string;
  description: string;
  startDateTime: string;
  endDateTime: string;
  duration: string;
  location: {
    address: string;
  };
  tickets: Ticket[];
}

interface NLPData {
  intents?: Intent[];
  entities?: Entity;
}

export const getAnswerForIntent = async (data: NLPData): Promise<string> => {
  const intent = data.intents?.[0]?.name;
  const entities = data.entities || {};

  switch (intent) {
    case "faq_attend_no_account":
      return "No, creating an account is mandatory to book and attend events. This allows us to manage your bookings securely, send you event updates, and provide a personalized experience. It also ensures that you can easily access, manage, or transfer your tickets if needed.";

    case "faq_cancel_event":
      return "To cancel an event, please go to the my bookings page and click the \"Cancel Event\" button. You'll then be prompted to confirm your decision. You'll also be refunded with the amount you paid minus the platform fees.";

    case "faq_book_ticket":
      return 'You can book your tickets directly on our event page by clicking the "Get Tickets" button and following the prompts, or through our authorized ticketing partners.';

    case "faq_online_payment":
      return "Absolutely. We partner with trusted payment providers like Stripe and Razorpay. All transactions are protected using advanced SSL encryption. Your payment information is never stored on our servers, ensuring maximum privacy and security.";

    case "event_details":
      return await getEventDetailAnswer(entities);

    default:
      return "Sorry, I couldn't find an answer to your question. Could you please rephrase or ask another question?";
  }
};

export const getEventDetailAnswer = async (
  entities: Entity
): Promise<string> => {
  let dbEvent: EventType[] = [];

  if (entities["event_name:event_name"]?.[0]?.value) {
    dbEvent = await Event.find({
      title: {
        $regex: entities["event_name:event_name"]?.[0]?.value,
        $options: "i",
      },
    }).populate("tickets.type");
  }

  if (dbEvent.length > 0) {
    const event = dbEvent[0];
    const detailType =
      entities["detail_type:location"]?.[0]?.role ||
      entities["detail_type:date"]?.[0]?.role ||
      entities["detail_type:duration"]?.[0]?.role ||
      entities["detail_type:price"]?.[0]?.role;

    return getDBEventDetailAnswer(event, detailType);
  } else {
    if (entities["event_name:event_name"]?.[0]?.value) {
      return `Sorry, I couldn't find any event with this name <b>${entities["event_name:event_name"]?.[0]?.value}</b>. Please check the spelling or try a different event name.`;
    } else {
      return "Sorry, I couldn't find any event with the provided details. Please give me a proper event name.";
    }
  }
};

export const getDBEventDetailAnswer = (
  event: EventType,
  detailType: string | undefined
): string => {
  switch (detailType) {
    case "date":
      return `The event starts on <b>${new Date(event.startDateTime).toLocaleString()}</b> and ends on <b>${new Date(event.endDateTime).toLocaleString()}</b>.`;

    case "duration":
      return `The event lasts for <b>${event.duration}</b>.`;

    case "location":
      return `The event will be held at <b>${event.location.address}</b>.`;

    case "price":
      const ticket = event.tickets.map(
        (ticket) =>
          `The <b>${ticket.type.name}</b> ticket costs <b>₹${ticket.price}</b>. It includes: <b>${ticket.type.description}</b>.`
      );
      return ticket.join("\n");

    default:
      return `Here are the details of the event <b>${event.title}</b>:\n${event.description}`;
  }
};
