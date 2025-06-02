import { Request, Response } from "express";
import { HTTP_STATUS_CODE } from "../utilits/enum";
import { getAnswerForIntent } from "../helper/chatbotReplays";

export const getWitAiResponse = async (req: Request, res: Response) => {
  const { message } = req.body;
  const WIT_TOKEN = process.env.WIT_SERVER_TOKEN;

  if (!message) {
    res
      .status(HTTP_STATUS_CODE.BAD_REQUEST)
      .json({ reply: "Message is required." });
    return;
  }

  try {
    const witRes = await fetch(
      `https://api.wit.ai/message?q=${encodeURIComponent(message)}`,
      {
        headers: {
          Authorization: `Bearer ${WIT_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!witRes.ok) {
      res
        .status(HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR)
        .json({ reply: "Failed to contact NLP service." });
      return;
    }

    const data = await witRes.json();

    const reply = await getAnswerForIntent(data);

    res.status(HTTP_STATUS_CODE.OK).json({ reply });
  } catch (error) {
    res
      .status(HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR)
      .json({ reply: "Server error while processing your request.", error });
  }
};
