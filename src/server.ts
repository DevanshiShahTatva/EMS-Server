import express, { json, urlencoded } from "express";
import dotenv from "dotenv";
import cors from "cors";
import rootRoutes from "./routes/index";
import { connectToDatabase } from "./config/dbConfig";
import bodyParser from "body-parser";
import compression from "compression";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { createLogger } from "./helper/logger";
const log = createLogger("standardMiddleware");

dotenv.config();

const app = express();

// middlewares
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(compression()); // compress the response
app.use(helmet()); // security purpose
app.use(json({ limit: "50mb" }));
app.use(urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      const allowedOrigins = [
        process.env.CLIENT_URL,
        "http://localhost:3000",
      ];

      if (allowedOrigins.includes(origin)) {
        log.info("CORS allowed for origin:", origin);
        return callback(null, true);
      }

      log.warn("CORS blocked for origin:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["Content-Range", "X-Content-Range"],
  })
);

// Connect to database
connectToDatabase();

// Use routes without global Multer middleware
app.use("/", rootRoutes);

const PORT = process.env.PORT;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
