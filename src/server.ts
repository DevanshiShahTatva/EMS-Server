import express from "express";
import dotenv from 'dotenv';
import cors from "cors";
import rootRoutes from "./routes/index";
import { connectToDatabase } from "./config/dbConfig";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// connect data base
connectToDatabase();

// verify api routes
app.use("/", rootRoutes);

const PORT = process.env.PORT;
app.listen(PORT, () => console.log(`server running on port ${PORT}`));