import express from 'express';
import { Section } from '../models/sections.js';
import { Department } from '../models/departments.js';
import { Employee } from '../models/employees.js';
import { sectionCreate, sectionUpdate, sectionQuery } from '../validation/schemas.js';
import { authRequired, requirePerm } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication and management.sections permission
router.use(authRequired);
router.use(requirePerm('management.sections'));

/**
 * GET /api/sections
 * Get paginated list of sections with optional department filter
 */
router.get('/', async (req, res, next) => {
  try {
    const { page, limit, departmentId } = sectionQuery.parse(req.query);
    const skip = (page - 1) * limit;

    const filter = departmentId ? { departmentId } : {};

    const [sections, total] = await Promise.all([
      Section.find(filter)
        .populate('departmentId', 'name')
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Section.countDocuments(filter)
    ]);

    res.json({
      ok: true,
      data: sections,
      meta: { total, page, limit }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/sections/:id
 * Get single section by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const section = await Section.findById(req.params.id)
      .populate('departmentId', 'name')
      .lean();

    if (!section) {
      return res.status(404).json({
        ok: false,
        error: { message: 'Section not found' }
      });
    }

    res.json({
      ok: true,
      data: section
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/sections
 * Create new section
 */
router.post('/', async (req, res, next) => {
  try {
    const validatedData = sectionCreate.parse(req.body);

    // Verify department exists
    const department = await Department.findById(validatedData.departmentId);
    if (!department) {
      return res.status(400).json({
        ok: false,
        error: { message: 'Department not found' }
      });
    }

    const section = new Section(validatedData);
    await section.save();

    // Populate department info for response
    await section.populate('departmentId', 'name');

    res.status(201).json({
      ok: true,
      data: section
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/sections/:id
 * Update section
 */
router.put('/:id', async (req, res, next) => {
  try {
    const validatedData = sectionUpdate.parse(req.body);

    // If departmentId is being updated, verify it exists
    if (validatedData.departmentId) {
      const department = await Department.findById(validatedData.departmentId);
      if (!department) {
        return res.status(400).json({
          ok: false,
          error: { message: 'Department not found' }
        });
      }
    }

    const section = await Section.findByIdAndUpdate(
      req.params.id,
      validatedData,
      { new: true, runValidators: true }
    ).populate('departmentId', 'name');

    if (!section) {
      return res.status(404).json({
        ok: false,
        error: { message: 'Section not found' }
      });
    }

    res.json({
      ok: true,
      data: section
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/sections/:id
 * Delete section (only if no employees exist)
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const sectionId = req.params.id;

    // Check if section has employees
    const employeeCount = await Employee.countDocuments({ sectionId });

    if (employeeCount > 0) {
      return res.status(409).json({
        ok: false,
        error: {
          message: 'Cannot delete section with existing employees',
          details: { employees: employeeCount }
        }
      });
    }

    const section = await Section.findByIdAndDelete(sectionId);

    if (!section) {
      return res.status(404).json({
        ok: false,
        error: { message: 'Section not found' }
      });
    }

    res.json({
      ok: true,
      data: { message: 'Section deleted successfully' }
    });
  } catch (error) {
    next(error);
  }
});

export default router;