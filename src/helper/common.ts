import { Request } from "express";
import { Document, Model } from "mongoose";
import User from "../models/signup.model";
import Event from "../models/event.modes";
import TicketBook from "../models/eventBooking.model";
import jwt from "jsonwebtoken";
import crypto from 'crypto';

interface IModelMap {
  [key: string]: Model<Document>;
}

const models: IModelMap = {
  User,
  Event,
  TicketBook,
};

export class ApiResponse<T = any> {
  status: number;
  data: T;
  success: boolean;
  message: string;

  constructor(data: T = {} as T, message = "OK", status = 200, success = true) {
    this.status = status;
    this.data = data;
    this.success = success;
    this.message = message;
  }
}

export const throwError = (
  res: any,
  errorMsg: string = "Internal Server Error",
  status: number = 500
) => {
  const rcResponse = new ApiResponse();
  rcResponse.message = errorMsg;
  rcResponse.status = status;
  rcResponse.success = false;
  return res.status(rcResponse.status).send(rcResponse);
};

export const throwIntenalServerError = (
  res: any,
  errorMsg: string = "Internal Server Error",
  status: number = 500
) => {
  const rcResponse = new ApiResponse();
  rcResponse.message = errorMsg;
  rcResponse.status = status;
  rcResponse.success = false;
  return res.send(rcResponse).status(rcResponse.status);
};

const find = async (
  collection: string,
  query: Record<string, any>,
  sort: any,
  // limit: number,
  // skip: number,
  populates: string[] = []
) => {
  try {
    let queryBuilder = models[collection].find(query).sort(sort);
    // .limit(limit)
    // .skip(skip);

    if (populates.length > 0) {
      populates.forEach((field: string) => {
        queryBuilder = queryBuilder.populate(field);
      });
    }

    return await queryBuilder;
  } catch (err) {
    throw err;
  }
};

const create = async (collection: string, data: any) => {
  try {
    return await new models[collection](data).save();
  } catch (err) {
    throw err;
  }
};

const findOne = async (
  collection: string,
  query: Record<string, any>,
  sort?: any
): Promise<any> => {
  try {
    let queryBuilder = models[collection]
      .findOne(query)
      .sort(sort)
      .lean()
      .exec();

    return await queryBuilder;
  } catch (error: any) {
    throw error;
  }
};

const findOneAndUpdate = async (
  collection: string,
  query: Record<string, any>,
  data: any,
  fields: any
) => {
  try {
    return await models[collection]
      .findOneAndUpdate(query, data, {
        fields,
        setDefaultsOnInsert: true,
        new: true,
        upsert: true,
      })
      .lean()
      .exec();
  } catch (err) {
    throw err;
  }
};

const updateOne = async (
  collection: string,
  query: Record<string, any>,
  body: any
): Promise<any> => {
  try {
    return await models[collection].updateOne(query, body).lean().exec();
  } catch (error: any) {
    throw error;
  }
};

const deleteOne = async (collection: string, query: Record<string, any>) => {
  try {
    return await models[collection].deleteOne(query).lean().exec();
  } catch (err) {
    throw err;
  }
};

const getUserIdFromToken = (req: Request) => {
  const token = (req.headers?.token as string) || "";
  const secretKey = process.env.TOKEN_SECRET as string;
  const tokenUser = jwt.verify(token, secretKey) as any;
  const userId = tokenUser._id;
  return userId;
};

export {
  find,
  findOne,
  findOneAndUpdate,
  updateOne,
  deleteOne,
  create,
  getUserIdFromToken,
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};