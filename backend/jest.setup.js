process.env.OPENAI_API_KEY = "test-key-for-ci";
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://test";

require("dotenv").config();

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.LOG_LEVEL = process.env.LOG_LEVEL || "error";
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-key-for-ci";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://test:test@localhost:5432/mateos_test";

jest.mock("./src/lib/prisma", () => ({
  $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }]),
  conversation: {
    update: jest.fn().mockResolvedValue({}),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  appointment: {
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  },
  medicalRecord: {
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  pet: {
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
}));
