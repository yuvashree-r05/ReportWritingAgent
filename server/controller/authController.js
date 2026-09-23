const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

// POST /api/auth/register
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "An account with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword
    });

    const { password: _, ...userWithoutPassword } = user.toObject();

    res.status(201).json({
      message: "Account created successfully",
      user: userWithoutPassword
      // Deliberately no token here — signup does not auto-log-in,
      // per the flow decided earlier (create account, then log in explicitly)
    });

  } catch (error) {
    console.log("Register Error", error);
    res.status(500).json({ message: "Server error creating account" });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const { password: _, ...userWithoutPassword } = user.toObject();
    const token = generateToken(user._id);

    res.status(200).json({
      message: "Login successful",
      user: userWithoutPassword,
      token
    });

  } catch (error) {
    console.log("Login Error", error);
    res.status(500).json({ message: "Server error logging in" });
  }
};

module.exports = { register, login };