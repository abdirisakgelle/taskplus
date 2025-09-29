import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcrypt";

// Import models
import { Department } from "../models/departments.js";
import { Section } from "../models/sections.js";
import { Employee } from "../models/employees.js";
import { User } from "../models/users.js";
import { Permission } from "../models/permissions.js";
import { Role } from "../models/roles.js";
import { UserAccess } from "../models/user_access.js";

// Optional models for nice-to-have seeding
import { Ticket } from "../models/tickets.js";
import { FollowUp } from "../models/follow_ups.js";
import { Review } from "../models/reviews.js";

/**
 * Connect to MongoDB using environment variables
 */
async function connectDB() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  
  if (!uri) {
    throw new Error("MongoDB URI is required. Please set MONGODB_URI or MONGO_URI environment variable.");
  }

  mongoose.set("strictQuery", true);

  const connectOptions = {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 10,
  };

  if (process.env.MONGODB_DB) {
    connectOptions.dbName = process.env.MONGODB_DB;
  }

  await mongoose.connect(uri, connectOptions);
  console.log(`✅ Connected to MongoDB: ${mongoose.connection.name || 'default'}`);
}

/**
 * Upsert helper function for idempotency
 */
async function upsertOne(Model, where, update) {
  const result = await Model.updateOne(
    where,
    { $setOnInsert: update },
    { upsert: true }
  );
  return result.upsertedCount > 0;
}

/**
 * Find or create with case-insensitive name matching
 */
async function findOrCreateByName(Model, name, additionalData = {}) {
  let doc = await Model.findOne({ name }).collation({ locale: 'en', strength: 2 });
  if (!doc) {
    doc = await Model.create({ name, ...additionalData });
  }
  return doc;
}

/**
 * Hash password using bcrypt cost 10
 */
async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

/**
 * Seed departments
 */
async function seedDepartments() {
  console.log("📁 Seeding departments...");
  
  const departments = ["Marcom"];
  
  for (const name of departments) {
    await findOrCreateByName(Department, name);
  }
}

/**
 * Seed sections under departments
 */
async function seedSections() {
  console.log("📂 Seeding sections...");
  
  const marcomDept = await Department.findOne({ name: "Marcom" });
  if (!marcomDept) {
    throw new Error("Marcom department not found");
  }

  const sections = [
    "Digital Media",
    "VOD", 
    "Support Operations",
    "Product Development"
  ];

  for (const name of sections) {
    const existing = await Section.findOne({ 
      departmentId: marcomDept._id, 
      name 
    }).collation({ locale: 'en', strength: 2 });
    
    if (!existing) {
      await Section.create({
        departmentId: marcomDept._id,
        name
      });
    }
  }
}

/**
 * Seed employees with department and section references
 */
async function seedEmployees() {
  console.log("👥 Seeding employees...");
  
  const marcomDept = await Department.findOne({ name: "Marcom" });
  
  const employeeData = [
    ["Abdirisak Mohamed Gelle", "Morning", "Admin", "Digital Media"],
    ["Asha Ali", "Morning", "Manager", "Digital Media"],
    ["Hodan Ibrahim", "Afternoon", "Supervisor", "Support Operations"],
    ["Ismail Abdiweli", "Night", "Agent", "Support Operations"],
    ["Saadaq Mayow", "Afternoon", "Follow-up Agent", "Support Operations"],
    ["Mos'ab Bashir", "Morning", "Content Creator", "Digital Media"],
    ["Liban Bashir", "Morning", "Editor", "VOD"],
    ["Mahdi Ismail", "Afternoon", "Social Media", "Digital Media"],
    ["Sharmake Kahie", "Morning", "Producer", "VOD"],
    ["Mohamed Mohamed", "Night", "QA Reviewer", "Support Operations"]
  ];

  for (const [name, shift, title, sectionName] of employeeData) {
    const section = await Section.findOne({ 
      departmentId: marcomDept._id, 
      name: sectionName 
    });
    
    if (!section) {
      console.warn(`⚠️ Section "${sectionName}" not found for employee "${name}"`);
      continue;
    }

    const existing = await Employee.findOne({ name });
    if (!existing) {
      await Employee.create({
        name,
        shift,
        title,
        departmentId: marcomDept._id,
        sectionId: section._id
      });
    }
  }
}

/**
 * Seed users for selected employees
 */
async function seedUsers() {
  console.log("👤 Seeding users...");
  
  const userMappings = [
    { employeeName: "Abdirisak Mohamed Gelle", username: "admin", email: "admin@example.com" },
    { employeeName: "Asha Ali", username: "manager", email: "manager@example.com" },
    { employeeName: "Hodan Ibrahim", username: "supervisor", email: "supervisor@example.com" },
    { employeeName: "Ismail Abdiweli", username: "agent", email: "agent@example.com" },
    { employeeName: "Saadaq Mayow", username: "followup", email: "followup@example.com" },
    { employeeName: "Mos'ab Bashir", username: "digitalmedia", email: "digitalmedia@example.com" }
  ];

  // Use plain password - the User model pre-save middleware will hash it
  const plainPassword = "Passw0rd!";

  for (const { employeeName, username, email } of userMappings) {
    const employee = await Employee.findOne({ name: employeeName });
    if (!employee) {
      console.warn(`⚠️ Employee "${employeeName}" not found for user "${username}"`);
      continue;
    }

    const existing = await User.findOne({ 
      $or: [{ username }, { email }, { employeeId: employee._id }] 
    });
    
    if (!existing) {
      await User.create({
        username,
        email,
        password: plainPassword,
        employeeId: employee._id,
        status: 'active'
      });
    }
  }
}

/**
 * Seed permission keys with groups
 */
async function seedPermissions() {
  console.log("🔑 Seeding permissions...");
  
  const permissions = [
    // Dashboards
    { key: "dashboard.view", label: "View Dashboards", group: "Dashboards" },
      
      // Management
    { key: "management.view", label: "View Management", group: "Management" },
    { key: "management.departments", label: "Departments CRUD", group: "Management" },
    { key: "management.sections", label: "Sections CRUD", group: "Management" },
    { key: "management.employees", label: "Employees CRUD", group: "Management" },
    { key: "management.users", label: "Users CRUD", group: "Management" },
    { key: "management.permissions", label: "Permissions View", group: "Management" },
    
    // Customer Support
    { key: "support.tickets", label: "Tickets", group: "Customer Support" },
    { key: "support.followups", label: "Follow-ups", group: "Customer Support" },
    { key: "support.reviews", label: "QA Reviews", group: "Customer Support" },
      
      // Tasks
    { key: "tasks.view", label: "View Tasks", group: "Tasks" },
    { key: "tasks.mine", label: "My Tasks", group: "Tasks" },
    { key: "tasks.create", label: "Create Tasks", group: "Tasks" },
    { key: "tasks.edit", label: "Edit Tasks", group: "Tasks" },
    { key: "tasks.delete", label: "Delete Tasks", group: "Tasks" },
    
    // Operations
    { key: "operations.calendar", label: "Calendar", group: "Operations" },
    { key: "operations.notifications", label: "Notifications", group: "Operations" },
      
      // Content
    { key: "content.ideas", label: "Ideas", group: "Content" },
    { key: "content.scripts", label: "Scripts", group: "Content" },
    { key: "content.production", label: "Production", group: "Content" },
    { key: "content.social", label: "Social Media", group: "Content" },
    { key: "content.library", label: "VOD Library", group: "Content" },
      
      // Reports
    { key: "reports.support", label: "Support KPIs", group: "Reports" },
    { key: "reports.content", label: "Content KPIs", group: "Reports" },
    { key: "reports.operations", label: "Ops & Productivity", group: "Reports" },
    { key: "reports.custom", label: "Custom Reports", group: "Reports" },
      
      // Settings
    { key: "settings.profile", label: "Edit Profile", group: "Settings" },
    { key: "settings.system", label: "System Settings", group: "Settings" },
    { key: "settings.access.manage", label: "Access Control", group: "Settings" }
  ];

  for (const perm of permissions) {
    await upsertOne(Permission, { key: perm.key }, perm);
  }
}

/**
 * Seed role presets with permission bundles
 */
async function seedRoles() {
  console.log("🎭 Seeding roles...");
  
  // Get all permission keys for admin role
  const allPermissions = await Permission.find({}, 'key').lean();
  const allPermissionKeys = allPermissions.map(p => p.key);
  
  const roles = [
    {
      key: "admin",
      label: "Administrator",
      description: "Full system access",
      permissions: allPermissionKeys
    },
    {
      key: "manager", 
      label: "Manager",
      description: "Department management and reporting access",
        permissions: [
        "dashboard.view", "management.view", "management.departments", 
        "management.sections", "management.employees", "support.tickets", 
        "support.followups", "support.reviews", "tasks.view", "tasks.mine",
        "tasks.create", "tasks.edit", "operations.calendar", "operations.notifications",
        "reports.support", "reports.content", "reports.operations", 
        "reports.custom", "content.ideas", "content.scripts", 
        "content.production", "content.social", "content.library", 
        "settings.profile"
      ]
    },
    {
      key: "supervisor",
      label: "Supervisor", 
      description: "Team supervision and support operations",
        permissions: [
        "dashboard.view", "support.tickets", "support.followups", 
        "support.reviews", "tasks.view", "tasks.mine", "operations.calendar",
        "reports.support", "reports.operations", "settings.profile"
      ]
    },
    {
      key: "agent",
      label: "Support Agent",
      description: "Customer support ticket handling",
        permissions: [
        "dashboard.view", "support.tickets", "settings.profile"
      ]
    },
    {
      key: "followup",
      label: "Follow-up Agent", 
      description: "Customer follow-up management",
        permissions: [
        "dashboard.view", "support.followups", "settings.profile"
      ]
    },
    {
      key: "digitalmedia",
      label: "Digital Media Specialist",
      description: "Content creation and social media management",
        permissions: [
        "dashboard.view", "content.ideas", "content.scripts", 
        "content.production", "content.social", "content.library", 
        "settings.profile"
      ]
    }
  ];

  for (const role of roles) {
    await upsertOne(Role, { key: role.key }, role);
  }
}

/**
 * Seed user access assignments
 */
async function seedUserAccess() {
  console.log("🔐 Seeding user access...");
  
  const accessMappings = [
    { username: "admin", roles: ["admin"], homeRoute: "/dashboard/admin" },
    { username: "manager", roles: ["manager"] },
    { username: "supervisor", roles: ["supervisor"] },
    { username: "agent", roles: ["agent"] },
    { username: "followup", roles: ["followup"] },
    { username: "digitalmedia", roles: ["digitalmedia"] }
  ];

  for (const { username, roles, homeRoute } of accessMappings) {
    const user = await User.findOne({ username });
    if (!user) {
      console.warn(`⚠️ User "${username}" not found for access assignment`);
      continue;
    }

    const accessData = {
      userId: user._id,
      roles,
      permsExtra: [],
      permsDenied: [],
      ...(homeRoute && { homeRoute })
    };

    await upsertOne(UserAccess, { userId: user._id }, accessData);
  }
}

/**
 * Optional: Seed sample tickets, follow-ups, and reviews
 */
async function seedSampleData() {
  console.log("📋 Seeding sample support data...");
  
  try {
    // Get some users for referencing
    const adminUser = await User.findOne({ username: "admin" });
    const agentUser = await User.findOne({ username: "agent" });
    const supervisorUser = await User.findOne({ username: "supervisor" });
    
    if (!adminUser || !agentUser || !supervisorUser) {
      console.log("⚠️ Skipping sample data - required users not found");
      return;
    }

    // Sample tickets
    const sampleTickets = [
      {
        title: "Login Issues",
        description: "User cannot access their account",
        status: "open",
        priority: "high",
        assignedTo: agentUser._id,
        createdBy: adminUser._id
      },
      {
        title: "Feature Request",
        description: "Request for new dashboard widget",
        status: "in_progress", 
        priority: "medium",
        assignedTo: agentUser._id,
        createdBy: supervisorUser._id
      }
    ];

    for (const ticketData of sampleTickets) {
      const existing = await Ticket.findOne({ title: ticketData.title });
      if (!existing) {
        await Ticket.create(ticketData);
      }
    }

    // Sample follow-ups
    const tickets = await Ticket.find().limit(2);
    for (const ticket of tickets) {
      const existing = await FollowUp.findOne({ ticketId: ticket._id });
      if (!existing) {
        await FollowUp.create({
          ticketId: ticket._id,
          message: "Following up on ticket status",
          createdBy: supervisorUser._id,
          status: "pending"
        });
      }
    }

    // Sample reviews
    for (const ticket of tickets) {
      const existing = await Review.findOne({ ticketId: ticket._id });
      if (!existing) {
        await Review.create({
          ticketId: ticket._id,
          reviewerId: supervisorUser._id,
          rating: 4,
          comments: "Well handled ticket",
          status: "completed"
        });
      }
    }

  } catch (error) {
    console.log("⚠️ Skipping sample data - models may not exist:", error.message);
  }
}

/**
 * Create indexes for optimal performance
 */
async function ensureIndexes() {
  console.log("📊 Ensuring database indexes...");
  
  try {
    // Permission key index
    await Permission.collection.createIndex({ key: 1 }, { unique: true });
    
    // Role key index  
    await Role.collection.createIndex({ key: 1 }, { unique: true });
    
    // UserAccess userId index
    await UserAccess.collection.createIndex({ userId: 1 }, { unique: true });
    
    console.log("✅ Database indexes ensured");
  } catch (error) {
    console.log("⚠️ Index creation warning:", error.message);
  }
}

/**
 * Print summary table of collection counts
 */
async function printSummary() {
  console.log("\n📊 Seeding Summary:");
  console.log("=".repeat(50));
  
  const collections = [
    "departments",
    "sections", 
    "employees",
    "users",
    "permissions",
    "roles",
    "useraccess"
  ];
  
  const summary = [];
  
  for (const collectionName of collections) {
    try {
      let count = 0;
      switch (collectionName) {
        case "departments":
          count = await Department.countDocuments();
          break;
        case "sections":
          count = await Section.countDocuments();
          break;
        case "employees":
          count = await Employee.countDocuments();
          break;
        case "users":
          count = await User.countDocuments();
          break;
        case "permissions":
          count = await Permission.countDocuments();
          break;
        case "roles":
          count = await Role.countDocuments();
          break;
        case "useraccess":
          count = await UserAccess.countDocuments();
          break;
      }
      summary.push({ Collection: collectionName, Count: count });
    } catch (error) {
      summary.push({ Collection: collectionName, Count: 'Error' });
    }
  }
  
  console.table(summary);
}

/**
 * Main seeding function
 */
async function main() {
  try {
    console.log("🌱 Starting database seeding...");
    console.log("=".repeat(50));
    
    await connectDB();
    await ensureIndexes();
    
    // Seed data in dependency order
    await seedDepartments();
    await seedSections();
    await seedEmployees();
    await seedUsers();
    await seedPermissions();
    await seedRoles();
    await seedUserAccess();
    await seedSampleData();
    
    await printSummary();
    
    console.log("\n✅ Database seeding completed successfully!");
    process.exit(0);

  } catch (error) {
    console.error("❌ Seeding failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

// Run the seeding script
main();