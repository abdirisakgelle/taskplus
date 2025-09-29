import express from "express";
import { Task } from "../models/tasks.js";
import { Ticket } from "../models/tickets.js";
import { FollowUp } from "../models/follow_ups.js";
import { Review } from "../models/reviews.js";
import { Idea } from "../models/ideas.js";
import { Content } from "../models/content.js";
import { Production } from "../models/production.js";
import { SocialMedia } from "../models/social_media.js";
import { Employee } from "../models/employees.js";
import { Department } from "../models/departments.js";
import { User } from "../models/users.js";
import { authRequired, requirePerm } from "../middleware/auth.js";

const router = express.Router();

// Dashboard overview statistics
router.get("/dashboard/overview", authRequired, requirePerm('reports.operations'), async (req, res, next) => {
  try {
    const { date_from, date_to } = req.query;
    
    // Date filter for time-based queries
    let dateFilter = {};
    if (date_from || date_to) {
      dateFilter.createdAt = {};
      if (date_from) dateFilter.createdAt.$gte = new Date(date_from);
      if (date_to) dateFilter.createdAt.$lte = new Date(date_to);
    }

    // Get all statistics in parallel
    const [
      taskStats,
      ticketStats,
      contentStats,
      employeeCount,
      departmentCount,
      userStats
    ] = await Promise.all([
      // Task statistics
      Task.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] } },
            in_progress: { $sum: { $cond: [{ $eq: ["$status", "In Progress"] }, 1, 0] } },
            not_started: { $sum: { $cond: [{ $eq: ["$status", "Not Started"] }, 1, 0] } },
            high_priority: { $sum: { $cond: [{ $eq: ["$priority", "High"] }, 1, 0] } },
            overdue: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ["$due_date", null] },
                      { $lt: ["$due_date", new Date()] },
                      { $ne: ["$status", "Completed"] }
                    ]
                  },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]),

      // Ticket statistics
      Ticket.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            open: { $sum: { $cond: [{ $eq: ["$resolution_status", "Open"] }, 1, 0] } },
            closed: { $sum: { $cond: [{ $eq: ["$resolution_status", "Closed"] }, 1, 0] } },
            in_progress: { $sum: { $cond: [{ $eq: ["$resolution_status", "In Progress"] }, 1, 0] } },
            first_call_resolution: { $sum: { $cond: ["$first_call_resolution", 1, 0] } }
          }
        }
      ]),

      // Content workflow statistics
      Content.aggregate([
        { $match: dateFilter },
        {
          $lookup: {
            from: "production",
            localField: "content_id",
            foreignField: "content_id",
            as: "productions"
          }
        },
        {
          $lookup: {
            from: "social_media",
            localField: "content_id",
            foreignField: "content_id",
            as: "social_posts"
          }
        },
        {
          $group: {
            _id: null,
            total_content: { $sum: 1 },
            with_productions: { $sum: { $cond: [{ $gt: [{ $size: "$productions" }, 0] }, 1, 0] } },
            with_social_posts: { $sum: { $cond: [{ $gt: [{ $size: "$social_posts" }, 0] }, 1, 0] } },
            filmed: { $sum: { $cond: [{ $ne: ["$filming_date", null] }, 1, 0] } }
          }
        }
      ]),

      // Employee count
      Employee.countDocuments(),

      // Department count  
      Department.countDocuments(),

      // User statistics
      User.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
            with_employee: { $sum: { $cond: [{ $ne: ["$employee_id", null] }, 1, 0] } }
          }
        }
      ])
    ]);

    const overview = {
      tasks: taskStats[0] || { total: 0, completed: 0, in_progress: 0, not_started: 0, high_priority: 0, overdue: 0 },
      tickets: ticketStats[0] || { total: 0, open: 0, closed: 0, in_progress: 0, first_call_resolution: 0 },
      content: contentStats[0] || { total_content: 0, with_productions: 0, with_social_posts: 0, filmed: 0 },
      employees: employeeCount,
      departments: departmentCount,
      users: userStats[0] || { total: 0, active: 0, with_employee: 0 }
    };

    // Add calculated rates
    if (overview.tasks.total > 0) {
      overview.tasks.completion_rate = ((overview.tasks.completed / overview.tasks.total) * 100).toFixed(2);
    }

    if (overview.tickets.total > 0) {
      overview.tickets.resolution_rate = ((overview.tickets.closed / overview.tickets.total) * 100).toFixed(2);
      overview.tickets.fcr_rate = ((overview.tickets.first_call_resolution / overview.tickets.total) * 100).toFixed(2);
    }

    if (overview.content.total_content > 0) {
      overview.content.production_rate = ((overview.content.with_productions / overview.content.total_content) * 100).toFixed(2);
      overview.content.social_rate = ((overview.content.with_social_posts / overview.content.total_content) * 100).toFixed(2);
    }

    res.json(overview);
  } catch (err) {
    next(err);
  }
});

// Task performance analytics
router.get("/tasks/performance", authRequired, requirePerm('reports.operations'), async (req, res, next) => {
  try {
    const { date_from, date_to, group_by = 'day' } = req.query;
    
    let dateFilter = {};
    if (date_from || date_to) {
      dateFilter.createdAt = {};
      if (date_from) dateFilter.createdAt.$gte = new Date(date_from);
      if (date_to) dateFilter.createdAt.$lte = new Date(date_to);
    }

    // Group by time period
    let dateGrouping;
    switch (group_by) {
      case 'hour':
        dateGrouping = {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          day: { $dayOfMonth: "$createdAt" },
          hour: { $hour: "$createdAt" }
        };
        break;
      case 'week':
        dateGrouping = {
          year: { $year: "$createdAt" },
          week: { $week: "$createdAt" }
        };
        break;
      case 'month':
        dateGrouping = {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" }
        };
        break;
      default: // day
        dateGrouping = {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          day: { $dayOfMonth: "$createdAt" }
        };
    }

    const taskPerformance = await Task.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: dateGrouping,
          created: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] } },
          in_progress: { $sum: { $cond: [{ $eq: ["$status", "In Progress"] }, 1, 0] } },
          high_priority: { $sum: { $cond: [{ $eq: ["$priority", "High"] }, 1, 0] } }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1, "_id.hour": 1 } }
    ]);

    res.json(taskPerformance);
  } catch (err) {
    next(err);
  }
});

// Employee productivity analytics
router.get("/employees/productivity", authRequired, requirePerm('reports.operations'), async (req, res, next) => {
  try {
    const { date_from, date_to, department_id } = req.query;
    
    let dateFilter = {};
    if (date_from || date_to) {
      dateFilter.createdAt = {};
      if (date_from) dateFilter.createdAt.$gte = new Date(date_from);
      if (date_to) dateFilter.createdAt.$lte = new Date(date_to);
    }

    // Get employee productivity data
    const productivity = await Task.aggregate([
      { $match: dateFilter },
      {
        $lookup: {
          from: "users",
          localField: "assigned_to",
          foreignField: "user_id",
          as: "user"
        }
      },
      {
        $lookup: {
          from: "employees",
          localField: "user.employee_id",
          foreignField: "employee_id",
          as: "employee"
        }
      },
      {
        $match: {
          "employee.0": { $exists: true }
        }
      },
      ...(department_id ? [{
        $match: {
          "employee.department": Number(department_id)
        }
      }] : []),
      {
        $group: {
          _id: {
            employee_id: { $arrayElemAt: ["$employee.employee_id", 0] },
            employee_name: { $arrayElemAt: ["$employee.name", 0] },
            department: { $arrayElemAt: ["$employee.department", 0] }
          },
          total_tasks: { $sum: 1 },
          completed_tasks: { $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] } },
          in_progress_tasks: { $sum: { $cond: [{ $eq: ["$status", "In Progress"] }, 1, 0] } },
          high_priority_tasks: { $sum: { $cond: [{ $eq: ["$priority", "High"] }, 1, 0] } },
          overdue_tasks: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$due_date", null] },
                    { $lt: ["$due_date", new Date()] },
                    { $ne: ["$status", "Completed"] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $addFields: {
          completion_rate: {
            $cond: [
              { $eq: ["$total_tasks", 0] },
              0,
              { $multiply: [{ $divide: ["$completed_tasks", "$total_tasks"] }, 100] }
            ]
          }
        }
      },
      { $sort: { completion_rate: -1 } }
    ]);

    res.json(productivity);
  } catch (err) {
    next(err);
  }
});

// Ticket resolution analytics
router.get("/tickets/resolution", authRequired, requirePerm('reports.operations'), async (req, res, next) => {
  try {
    const { date_from, date_to } = req.query;
    
    let dateFilter = {};
    if (date_from || date_to) {
      dateFilter.createdAt = {};
      if (date_from) dateFilter.createdAt.$gte = new Date(date_from);
      if (date_to) dateFilter.createdAt.$lte = new Date(date_to);
    }

    // Get ticket resolution analytics
    const [resolutionStats, channelStats, issueTypeStats, agentStats] = await Promise.all([
      // Resolution time analysis
      Ticket.aggregate([
        { $match: { ...dateFilter, resolution_status: "Closed" } },
        {
          $lookup: {
            from: "follow_ups",
            localField: "ticket_id", 
            foreignField: "ticket_id",
            as: "followups"
          }
        },
        {
          $addFields: {
            resolution_time: {
              $subtract: ["$updatedAt", "$createdAt"]
            },
            followup_count: { $size: "$followups" }
          }
        },
        {
          $group: {
            _id: null,
            avg_resolution_time: { $avg: "$resolution_time" },
            total_resolved: { $sum: 1 },
            avg_followups: { $avg: "$followup_count" },
            first_call_resolutions: { $sum: { $cond: ["$first_call_resolution", 1, 0] } }
          }
        }
      ]),

      // Channel distribution
      Ticket.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: "$communication_channel",
            count: { $sum: 1 },
            resolved: { $sum: { $cond: [{ $eq: ["$resolution_status", "Closed"] }, 1, 0] } },
            fcr: { $sum: { $cond: ["$first_call_resolution", 1, 0] } }
          }
        },
        { $sort: { count: -1 } }
      ]),

      // Issue type analysis
      Ticket.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: "$issue_type",
            count: { $sum: 1 },
            resolved: { $sum: { $cond: [{ $eq: ["$resolution_status", "Closed"] }, 1, 0] } },
            fcr: { $sum: { $cond: ["$first_call_resolution", 1, 0] } }
          }
        },
        { $sort: { count: -1 } }
      ]),

      // Agent performance
      Ticket.aggregate([
        { $match: { ...dateFilter, agent_id: { $ne: null } } },
        {
          $lookup: {
            from: "employees",
            localField: "agent_id",
            foreignField: "employee_id",
            as: "agent"
          }
        },
        {
          $group: {
            _id: {
              agent_id: "$agent_id",
              agent_name: { $arrayElemAt: ["$agent.name", 0] }
            },
            total_tickets: { $sum: 1 },
            resolved_tickets: { $sum: { $cond: [{ $eq: ["$resolution_status", "Closed"] }, 1, 0] } },
            fcr_tickets: { $sum: { $cond: ["$first_call_resolution", 1, 0] } }
          }
        },
        {
          $addFields: {
            resolution_rate: {
              $cond: [
                { $eq: ["$total_tickets", 0] },
                0,
                { $multiply: [{ $divide: ["$resolved_tickets", "$total_tickets"] }, 100] }
              ]
            },
            fcr_rate: {
              $cond: [
                { $eq: ["$total_tickets", 0] },
                0,
                { $multiply: [{ $divide: ["$fcr_tickets", "$total_tickets"] }, 100] }
              ]
            }
          }
        },
        { $sort: { resolution_rate: -1 } }
      ])
    ]);

    res.json({
      resolution_stats: resolutionStats[0] || {},
      channel_distribution: channelStats,
      issue_type_analysis: issueTypeStats,
      agent_performance: agentStats
    });
  } catch (err) {
    next(err);
  }
});

// Content workflow analytics
router.get("/content/workflow", authRequired, requirePerm('reports.operations'), async (req, res, next) => {
  try {
    const { date_from, date_to } = req.query;
    
    let dateFilter = {};
    if (date_from || date_to) {
      dateFilter.createdAt = {};
      if (date_from) dateFilter.createdAt.$gte = new Date(date_from);
      if (date_to) dateFilter.createdAt.$lte = new Date(date_to);
    }

    const [ideaStats, contentStats, productionStats, socialStats] = await Promise.all([
      // Idea statistics
      Idea.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            draft: { $sum: { $cond: [{ $eq: ["$status", "Draft"] }, 1, 0] } },
            approved: { $sum: { $cond: [{ $eq: ["$status", "Approved"] }, 1, 0] } },
            rejected: { $sum: { $cond: [{ $eq: ["$status", "Rejected"] }, 1, 0] } },
            in_review: { $sum: { $cond: [{ $eq: ["$status", "In Review"] }, 1, 0] } }
          }
        }
      ]),

      // Content production statistics
      Content.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            filmed: { $sum: { $cond: [{ $ne: ["$filming_date", null] }, 1, 0] } },
            pending_filming: { $sum: { $cond: [{ $eq: ["$filming_date", null] }, 1, 0] } }
          }
        }
      ]),

      // Production statistics
      Production.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            editing: { $sum: { $cond: [{ $eq: ["$production_status", "Editing"] }, 1, 0] } },
            review: { $sum: { $cond: [{ $eq: ["$production_status", "Review"] }, 1, 0] } },
            completed: { $sum: { $cond: [{ $eq: ["$production_status", "Completed"] }, 1, 0] } },
            sent_to_social: { $sum: { $cond: ["$sent_to_social_team", 1, 0] } }
          }
        }
      ]),

      // Social media statistics
      SocialMedia.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            draft: { $sum: { $cond: [{ $eq: ["$status", "Draft"] }, 1, 0] } },
            approved: { $sum: { $cond: [{ $eq: ["$status", "Approved"] }, 1, 0] } },
            published: { $sum: { $cond: [{ $eq: ["$status", "Published"] }, 1, 0] } },
            scheduled: { $sum: { $cond: [{ $eq: ["$status", "Scheduled"] }, 1, 0] } }
          }
        }
      ])
    ]);

    const workflow = {
      ideas: ideaStats[0] || { total: 0, draft: 0, approved: 0, rejected: 0, in_review: 0 },
      content: contentStats[0] || { total: 0, filmed: 0, pending_filming: 0 },
      production: productionStats[0] || { total: 0, editing: 0, review: 0, completed: 0, sent_to_social: 0 },
      social_media: socialStats[0] || { total: 0, draft: 0, approved: 0, published: 0, scheduled: 0 }
    };

    // Add calculated rates
    if (workflow.ideas.total > 0) {
      workflow.ideas.approval_rate = ((workflow.ideas.approved / workflow.ideas.total) * 100).toFixed(2);
    }

    if (workflow.content.total > 0) {
      workflow.content.filming_rate = ((workflow.content.filmed / workflow.content.total) * 100).toFixed(2);
    }

    if (workflow.production.total > 0) {
      workflow.production.completion_rate = ((workflow.production.completed / workflow.production.total) * 100).toFixed(2);
    }

    if (workflow.social_media.total > 0) {
      workflow.social_media.publish_rate = ((workflow.social_media.published / workflow.social_media.total) * 100).toFixed(2);
    }

    res.json(workflow);
  } catch (err) {
    next(err);
  }
});

// Department analytics
router.get("/departments/overview", authRequired, requirePerm('reports.operations'), async (req, res, next) => {
  try {
    const departmentAnalytics = await Department.aggregate([
      {
        $lookup: {
          from: "employees",
          localField: "department_id",
          foreignField: "department",
          as: "employees"
        }
      },
      {
        $lookup: {
          from: "sections",
          localField: "department_id", 
          foreignField: "department_id",
          as: "sections"
        }
      },
      {
        $addFields: {
          employee_count: { $size: "$employees" },
          section_count: { $size: "$sections" }
        }
      },
      {
        $project: {
          department_id: 1,
          name: 1,
          employee_count: 1,
          section_count: 1,
          employees: {
            $map: {
              input: "$employees",
              as: "emp",
              in: {
                employee_id: "$$emp.employee_id",
                name: "$$emp.name",
                title: "$$emp.title",
                shift: "$$emp.shift"
              }
            }
          }
        }
      },
      { $sort: { employee_count: -1 } }
    ]);

    res.json(departmentAnalytics);
  } catch (err) {
    next(err);
  }
});

// System usage analytics
router.get("/system/usage", authRequired, requirePerm('reports.operations'), async (req, res, next) => {
  try {
    const { date_from, date_to } = req.query;
    
    let dateFilter = {};
    if (date_from || date_to) {
      dateFilter.createdAt = {};
      if (date_from) dateFilter.createdAt.$gte = new Date(date_from);
      if (date_to) dateFilter.createdAt.$lte = new Date(date_to);
    }

    // Get system usage statistics
    const [userActivity, dataCreation] = await Promise.all([
      // User activity (based on last login - you'd need to track this)
      User.aggregate([
        {
          $group: {
            _id: null,
            total_users: { $sum: 1 },
            active_users: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
            users_with_employees: { $sum: { $cond: [{ $ne: ["$employee_id", null] }, 1, 0] } }
          }
        }
      ]),

      // Data creation trends
      Promise.all([
        Task.aggregate([
          { $match: dateFilter },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              tasks_created: { $sum: 1 }
            }
          },
          { $sort: { "_id": 1 } }
        ]),
        Ticket.aggregate([
          { $match: dateFilter },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              tickets_created: { $sum: 1 }
            }
          },
          { $sort: { "_id": 1 } }
        ]),
        Content.aggregate([
          { $match: dateFilter },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              content_created: { $sum: 1 }
            }
          },
          { $sort: { "_id": 1 } }
        ])
      ])
    ]);

    res.json({
      user_activity: userActivity[0] || { total_users: 0, active_users: 0, users_with_employees: 0 },
      data_trends: {
        tasks: dataCreation[0],
        tickets: dataCreation[1], 
        content: dataCreation[2]
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
