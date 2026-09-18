const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

app.use(cors());
app.use(express.json());

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Middleware
app.use(cors());
app.use(express.json());
// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
  })
  .catch((error) => {
    console.error("❌ MongoDB connection error:", error.message);
  });

// Order Schema
const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      unique: true,
      required: true
    },

    customer: {
      fullName: {
        type: String,
        required: true,
        trim: true
      },

      phone: {
        type: String,
        required: true,
        trim: true
      },

      email: {
        type: String,
        trim: true,
        lowercase: true
      }
    },

    service: {
      type: String,
      required: true,
      trim: true
    },

    serviceDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },

    message: {
      type: String,
      default: ""
    },

    payment: {
      status: {
        type: String,
        enum: ["PENDING", "PAID", "REFUNDED"],
        default: "PENDING"
      },

      amount: {
        type: Number,
        default: 0
      },

      reference: {
        type: String,
        default: ""
      }
    },

    status: {
      type: String,
      enum: [
        "NEW",
        "QUOTATION",
        "PAYMENT_PENDING",
        "PAID",
        "PROCESSING",
        "CLIENT_REVIEW",
        "COMPLETED",
        "CANCELLED"
      ],
      default: "NEW"
    },

    adminNotes: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

const Order = mongoose.model("Order", orderSchema);

// Generate Order ID
function generateOrderId() {
  const random = Math.floor(100000 + Math.random() * 900000);
  return `RL-${random}`;
}

// Admin Login
app.post("/api/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required."
      });
    }

    if (username !== process.env.ADMIN_USERNAME) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password."
      });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      process.env.ADMIN_PASSWORD_HASH
    );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password."
      });
    }

    const token = jwt.sign(
      {
        username: process.env.ADMIN_USERNAME,
        role: "admin"
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "2h"
      }
    );

    res.json({
      success: true,
      message: "Login successful.",
      token
    });

  } catch (error) {
    console.error("Admin login error:", error);

    res.status(500).json({
      success: false,
      message: "Server error."
    });
  }
});

// Test route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "R&L Online Services API is running 🚀"
  });
});

// Create Order
app.post("/api/admin/login", async (req, res) => {
  console.log("ADMIN LOGIN TEST:", {
    usernameReceived: req.body?.username,
    usernameExpected: process.env.ADMIN_USERNAME,
    hasPasswordHash: !!process.env.ADMIN_PASSWORD_HASH,
    hasJwtSecret: !!process.env.JWT_SECRET
  });

  try {
    const { username, password } = req.body;
  try {
    const {
      fullName,
      phone,
      email,
      service,
      serviceDetails,
      message
    } = req.body;

    if (!fullName || !phone || !service) {
      return res.status(400).json({
        success: false,
        message: "Full name, phone and service are required."
      });
    }

    const order = new Order({
      orderId: generateOrderId(),

      customer: {
        fullName,
        phone,
        email
      },

      service,
      serviceDetails: serviceDetails || {},
      message: message || "",

      payment: {
        status: "PENDING",
        amount: 0,
        reference: ""
      },

      status: "NEW"
    });

    await order.save();

    res.status(201).json({
      success: true,
      message: "Order created successfully.",
      order
    });

  } catch (error) {
    console.error("Create order error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create order."
    });
  }
});

// Get All Orders
app.get("/api/orders", async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      orders
    });

  } catch (error) {
    console.error("Get orders error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to get orders."
    });
  }
});

// Get Single Order
app.get("/api/orders/:orderId", async (req, res) => {
  try {
    const order = await Order.findOne({
      orderId: req.params.orderId
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found."
      });
    }

    res.json({
      success: true,
      order
    });

  } catch (error) {
    console.error("Get order error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to get order."
    });
  }
});

// Update Order
app.patch("/api/orders/:orderId", async (req, res) => {
  try {
    const allowedUpdates = [
      "status",
      "adminNotes",
      "payment"
    ];

    const updates = {};

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const order = await Order.findOneAndUpdate(
      { orderId: req.params.orderId },
      { $set: updates },
      {
        new: true,
        runValidators: true
      }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found."
      });
    }

    res.json({
      success: true,
      message: "Order updated successfully.",
      order
    });

  } catch (error) {
    console.error("Update order error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update order."
    });
  }
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found."
  });
});

// Start Server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 R&L Online Services API running on port ${PORT}`);
});
