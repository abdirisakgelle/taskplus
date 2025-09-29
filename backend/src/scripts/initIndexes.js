import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../db.js";
import { Department } from "../models/departments.js";
import { Section } from "../models/sections.js";
import { Employee } from "../models/employees.js";
import { User } from "../models/users.js";
import { Permission } from "../models/permissions.js";
import { Ticket } from "../models/tickets.js";
import { FollowUp } from "../models/follow_ups.js";
import { Review } from "../models/reviews.js";
import { Idea } from "../models/ideas.js";
import { Content } from "../models/content.js";
import { Production } from "../models/production.js";
import { SocialMedia } from "../models/social_media.js";
import { Task } from "../models/tasks.js";
import { Notification } from "../models/notifications.js";
import { Vod } from "../models/vod.js";

async function main() {
  await connectDB(process.env.MONGO_URI);

  await Department.collection.createIndex({ department_id: 1 }, { unique: true });

  await Section.collection.createIndex({ section_id: 1 }, { unique: true });
  await Section.collection.createIndex({ department_id: 1 });

  await Employee.collection.createIndex({ employee_id: 1 }, { unique: true });
  await Employee.collection.createIndex({ department: 1 });

  await User.collection.createIndex({ user_id: 1 }, { unique: true });
  await User.collection.createIndex({ username: 1 }, { unique: true });

  await Permission.collection.createIndex({ permission_id: 1 }, { unique: true });
  await Permission.collection.createIndex({ user_id: 1, page_name: 1 }, { unique: true });

  await Ticket.collection.createIndex({ ticket_id: 1 }, { unique: true });
  await Ticket.collection.createIndex({ agent_id: 1, createdAt: -1 });
  await Ticket.collection.createIndex({ communication_channel: 1 });
  await Ticket.collection.createIndex({ issue_type: 1 });

  await FollowUp.collection.createIndex({ follow_up_id: 1 }, { unique: true });
  await FollowUp.collection.createIndex({ ticket_id: 1 });
  await FollowUp.collection.createIndex({ follow_up_agent_id: 1 });

  await Review.collection.createIndex({ review_id: 1 }, { unique: true });
  await Review.collection.createIndex({ ticket_id: 1, reviewer_id: 1 });

  await Idea.collection.createIndex({ idea_id: 1 }, { unique: true });
  await Idea.collection.createIndex({ contributor: 1, status: 1 });

  await Content.collection.createIndex({ content_id: 1 }, { unique: true });
  await Content.collection.createIndex({ idea_id: 1 });

  await Production.collection.createIndex({ production_id: 1 }, { unique: true });
  await Production.collection.createIndex({ content_id: 1, production_status: 1 });

  await SocialMedia.collection.createIndex({ post_id: 1 }, { unique: true });
  await SocialMedia.collection.createIndex({ content_id: 1, status: 1, post_date: -1 });

  await Task.collection.createIndex({ task_id: 1 }, { unique: true });
  await Task.collection.createIndex({ assigned_to: 1, status: 1, priority: 1 });

  await Notification.collection.createIndex({ notification_id: 1 }, { unique: true });
  await Notification.collection.createIndex({ user_id: 1, is_read: 1, createdAt: -1 });

  await Vod.collection.createIndex({ vod_id: 1 }, { unique: true });
  await Vod.collection.createIndex({ title: 1 });

  console.log("Indexes created");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


