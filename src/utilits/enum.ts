import express from "express";

export const HTTP_STATUS_CODE = {
  OK: 200, // successfull GET/PUT request
  CREATED: 201, // resource created POST
  BAD_REQUEST: 400, // invalid request payload
  NOT_FOUND: 404, // not found,
  CONFLICT: 409, //duplicate resource
  INTERNAL_SERVER_ERROR: 500, // internal server error
};

export const PASSWORD_SOLT = 10;

export const CATEGORY_ENUM = [
  "Music",
  "Art & Culture",
  "Film & Media",
  "Education",
  "Sports",
  "Food & Drink",
  "Wellness",
  "Gaming",
  "Business",
];

export const COOKIE_OPTIONS: express.CookieOptions = {
  httpOnly: true,
  sameSite: 'none',
  secure: process.env.NODE_ENV === 'production',
};

export const allowedOrigins = ["http://localhost:3000", process.env.CLIENT_URL];
