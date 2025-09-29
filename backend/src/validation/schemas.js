import { z } from 'zod';

// Department validation
export const departmentCreate = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters')
});

export const departmentUpdate = departmentCreate.partial();

// Section validation
export const sectionCreate = z.object({
  departmentId: z.string().min(1, 'Department ID is required'),
  name: z.string().min(2, 'Name must be at least 2 characters')
});

export const sectionUpdate = sectionCreate.partial();

// Employee validation
export const employeeCreate = z.object({
  employee_id: z.number().optional(),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  shift: z.enum(['Morning', 'Afternoon', 'Night']).optional(),
  title: z.string().optional(),
  phone: z.string().optional(),
  departmentId: z.string().min(1, 'Department ID is required'),
  sectionId: z.string().min(1, 'Section ID is required')
});

export const employeeUpdate = employeeCreate.partial();

// User validation
export const userCreate = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  employeeId: z.string().min(1, 'Employee ID is required')
});

export const userUpdate = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').optional(),
  email: z.string().email('Invalid email format').optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  status: z.enum(['active', 'disabled']).optional()
});

// Access validation
export const accessUpdate = z.object({
  roles: z.array(z.string()).default([]),
  permsExtra: z.array(z.string()).default([]),
  permsDenied: z.array(z.string()).default([]),
  homeRoute: z.string().optional(),
  pageAccess: z.array(z.object({
    permission: z.string().min(1, 'Permission is required'),
    allowedPages: z.array(z.number().min(1)).optional(),
    maxPages: z.number().min(1).optional(),
    sectionsAllowed: z.array(z.string()).optional()
  })).default([]),
  departmentRestrictions: z.array(z.string()).default([]),
  sectionRestrictions: z.array(z.string()).default([])
});

// Auth validation
export const loginSchema = z.object({
  identifier: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required')
});

// Query validation
export const paginationSchema = z.object({
  page: z.string().transform(val => Math.max(1, parseInt(val) || 1)),
  limit: z.string().transform(val => Math.min(100, Math.max(1, parseInt(val) || 20)))
});

export const departmentQuery = paginationSchema;

export const sectionQuery = paginationSchema.extend({
  departmentId: z.string().optional()
});

export const employeeQuery = paginationSchema.extend({
  departmentId: z.string().optional(),
  sectionId: z.string().optional()
});
