import express from "express";
import dotenv from 'dotenv';
import cors from "cors";
import rootRoutes from "./routes/index";
import { connectToDatabase } from "./config/dbConfig";
import bodyParser from "body-parser";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Connect to database
connectToDatabase();

// Use routes without global Multer middleware
app.use("/", rootRoutes);

const PORT = process.env.PORT;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
