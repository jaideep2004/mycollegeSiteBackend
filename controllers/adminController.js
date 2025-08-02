const Student = require("../models/Student");
const Faculty = require("../models/Faculty");
const Result = require("../models/Result");
const Document = require("../models/Document");
const Admission = require("../models/Admission");
const Course = require("../models/Course");
const Department = require("../models/Department");
const Category = require("../models/Category");
const { sendEmail } = require("../utils/notify");
const Notification = require("../models/Notification");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const Payment = require("../models/Payment");
const xlsx = require("xlsx");

exports.getDepartments = async (req, res) => {
	try {
		const departments = await Department.find();
		res.json({ success: true, data: departments });
	} catch (err) {
		res.status(500).json({ success: false, error: err.message });
	}
};

exports.getCategories = async (req, res) => {
	try {
		const categories = await Category.find();
		res.json({ success: true, data: categories });
	} catch (err) {
		res.status(500).json({ success: false, error: err.message });
	}
};

exports.getCourses = async (req, res) => {
	// New endpoint
	try {
		const courses = await Course.find().populate("departmentId categoryId");
		res.json({ success: true, data: courses });
	} catch (err) {
		res.status(500).json({ success: false, error: err.message });
	}
};

exports.addContent = async (req, res) => {
	const {
		type,
		title,
		description,
		semester,
		fileUrl,
		thumbnailUrl,
		eventDate,
		category,
	} = req.body;
	try {
		// Make sure fileUrl is always set
		const finalFileUrl =
			fileUrl || "https://via.placeholder.com/800x600?text=No+Image";

		const document = new Document({
			type,
			title,
			description,
			semester,
			fileUrl: finalFileUrl,
			thumbnailUrl: thumbnailUrl || finalFileUrl,
			eventDate,
			category,
			createdBy: req.user.id,
			updatedAt: Date.now(),
		});
		await document.save();
		res.json({ success: true, data: document });
	} catch (err) {
		console.error("Error adding content:", err);
		res.status(500).json({ success: false, error: err.message });
	}
};

exports.updateContent = async (req, res) => {
	const {
		type,
		title,
		description,
		semester,
		fileUrl,
		thumbnailUrl,
		eventDate,
	} = req.body;
	try {
		const document = await Document.findByIdAndUpdate(
			req.params.id,
			{
				type,
				title,
				description,
				semester,
				fileUrl,
				thumbnailUrl,
				eventDate,
				updatedAt: Date.now(),
			},
			{ new: true }
		);

		if (!document) {
			return res
				.status(404)
				.json({ success: false, error: "Document not found" });
		}

		res.json({ success: true, data: document });
	} catch (err) {
		res.status(500).json({ success: false, error: err.message });
	}
};

exports.deleteContent = async (req, res) => {
	try {
		const document = await Document.findByIdAndDelete(req.params.id);

		if (!document) {
			return res
				.status(404)
				.json({ success: false, error: "Document not found" });
		}

		res.json({
			success: true,
			data: { message: "Document deleted successfully" },
		});
	} catch (err) {
		res.status(500).json({ success: false, error: err.message });
	}
};

exports.getAllContent = async (req, res) => {
	try {
		const { type, page = 1, limit = 10, search } = req.query;
		const query = {};

		// Filter by type if provided
		if (type) {
			query.type = type;
		}

		// Search in title and description if provided
		if (search) {
			query.$or = [
				{ title: { $regex: search, $options: "i" } },
				{ description: { $regex: search, $options: "i" } },
			];
		}

		// Count total documents
		const total = await Document.countDocuments(query);

		// Get documents with pagination
		const documents = await Document.find(query)
			.sort({ updatedAt: -1 })
			.skip((page - 1) * limit)
			.limit(parseInt(limit));

		res.json({
			success: true,
			data: documents,
			pagination: {
				total,
				page: parseInt(page),
				limit: parseInt(limit),
				pages: Math.ceil(total / limit),
			},
		});
	} catch (err) {
		console.error("Error fetching content:", err);
		res.status(500).json({ success: false, error: err.message });
	}
};

exports.getContentByType = async (req, res) => {
	try {
		const documents = await Document.find({ type: req.params.type }).sort({
			updatedAt: -1,
		});
		res.json({ success: true, data: documents });
	} catch (err) {
		res.status(500).json({ success: false, error: err.message });
	}
};

exports.getContentById = async (req, res) => {
	try {
		const document = await Document.findById(req.params.id);

		if (!document) {
			return res
				.status(404)
				.json({ success: false, error: "Document not found" });
		}

		res.json({ success: true, data: document });
	} catch (err) {
		res.status(500).json({ success: false, error: err.message });
	}
};

exports.getUsers = async (req, res) => {
	try {
		const students = await Student.find();
		const faculty = await Faculty.find();
		res.json({ success: true, data: { students, faculty } });
	} catch (err) {
		res.status(500).json({ success: false, error: err.message });
	}
};

exports.getAdmissions = async (req, res) => {
	try {
		const admissions = await Admission.find().populate("studentId courseId");
		res.json({ success: true, data: admissions });
	} catch (err) {
		res.status(500).json({ success: false, error: err.message });
	}
};

exports.updateAdmission = async (req, res) => {
	const { status } = req.body;
	try {
		const admission = await Admission.findByIdAndUpdate(
			req.params.id,
			{ status },
			{ new: true }
		).populate("studentId courseId");
		if (!admission)
			return res
				.status(404)
				.json({ success: false, error: "Admission not found" });

		await sendEmail(
			admission.studentId.email,
			"Admission Update",
			`Your admission for ${admission.courseId.name} is ${status}. ${
				status === "approved" ? "Please pay the full fee." : ""
			}`
		);

		await new Notification({
			userId: admission.studentId._id,
			userModel: "Student",
			message: `Admission ${status}`,
			type: "in-app",
		}).save();

		res.json({ success: true, data: admission });
	} catch (err) {
		res.status(500).json({ success: false, error: err.message });
	}
};

exports.uploadResults = async (req, res) => {
	try {
		if (!req.file) {
			return res
				.status(400)
				.json({ success: false, error: "No file uploaded" });
		}

		const fileBuffer = req.file.buffer;
		const workbook = xlsx.read(fileBuffer, { type: "buffer" });
		const worksheet = workbook.Sheets[workbook.SheetNames[0]];
		const rawData = xlsx.utils.sheet_to_json(worksheet);

		// Clean up the data by trimming whitespace from keys and values
		const data = rawData.map((row) => {
			const cleanRow = {};
			Object.keys(row).forEach((key) => {
				// Remove spaces from keys
				const cleanKey = key.trim();
				// Convert field names to match expected format
				const normalizedKey = cleanKey
					.replace(/\s+/g, "") // Remove all spaces
					.replace(/^Student(Name)?$/i, "studentName")
					.replace(/^Course(Name|Title)?$/i, "courseTitle")
					.replace(/^Semester$/i, "semester")
					.replace(/^Marks$/i, "marks");

				// Clean the value if it's a string
				const value = typeof row[key] === "string" ? row[key].trim() : row[key];
				cleanRow[normalizedKey] = value;
			});
			return cleanRow;
		});

		const results = [];
		const errors = [];

		for (let row of data) {
			try {
				// Validate required fields
				if (
					!row.studentName ||
					!row.courseTitle ||
					!row.semester ||
					!row.marks
				) {
					errors.push(`Missing required fields in row: ${JSON.stringify(row)}`);
					continue;
				}

				// Find student by name
				const student = await Student.findOne({
					name: { $regex: new RegExp("^" + row.studentName.trim() + "$", "i") },
				});

				if (!student) {
					errors.push(`Student not found with name: ${row.studentName}`);
					continue;
				}

				// Find course by name
				const course = await Course.findOne({
					name: { $regex: new RegExp("^" + row.courseTitle.trim() + "$", "i") },
				});

				if (!course) {
					errors.push(`Course not found with name: ${row.courseTitle}`);
					continue;
				}

				// Validate semester
				const semesterNum = parseInt(row.semester);
				if (isNaN(semesterNum) || semesterNum < 1 || semesterNum > 8) {
					errors.push(
						`Invalid semester value for student ${row.studentName}: ${row.semester}`
					);
					continue;
				}

				// Validate marks
				const marks = parseFloat(row.marks);
				if (isNaN(marks) || marks < 0 || marks > 100) {
					errors.push(
						`Invalid marks value for student ${row.studentName}: ${row.marks}`
					);
					continue;
				}

				// Calculate grade based on marks
				const grade = calculateGrade(marks);

				// Check if result already exists
				const existingResult = await Result.findOne({
					studentId: student._id,
					courseId: course._id,
					semester: semesterNum.toString(),
				});

				if (existingResult) {
					// Update existing result
					existingResult.marks = marks;
					existingResult.grade = grade;
					await existingResult.save();
					results.push(existingResult);
				} else {
					// Create new result
					const result = new Result({
						studentId: student._id,
						courseId: course._id,
						semester: semesterNum.toString(),
						marks: marks,
						grade: grade,
						uploadedBy: req.user._id,
					});

					await result.save();
					results.push(result);
				}
			} catch (error) {
				errors.push(
					`Error processing row for student ${row.studentName}: ${error.message}`
				);
			}
		}

		res.json({
			success: true,
			data: {
				results,
				errors,
				totalProcessed: data.length,
				successCount: results.length,
				errorCount: errors.length,
			},
		});
	} catch (err) {
		console.error("Error uploading results:", err);
		res.status(500).json({ success: false, error: err.message });
	}
};

exports.addResult = async (req, res) => {
	try {
		const { studentId, courseId, semester, marks } = req.body;

		// Calculate grade based on marks
		const grade = calculateGrade(marks);

		const result = new Result({
			studentId,
			courseId,
			semester,
			marks,
			grade,
			uploadedBy: req.user._id,
		});

		await result.save();

		// Populate student and course details
		await result.populate("studentId courseId");

		res.json({ success: true, data: result });
	} catch (err) {
		res.status(500).json({ success: false, error: err.message });
	}
};

exports.getResults = async (req, res) => {
	try {
		const { studentId, courseId, semester } = req.query;
		const query = {};

		if (studentId) query.studentId = studentId;
		if (courseId) query.courseId = courseId;
		if (semester) query.semester = semester;

		const results = await Result.find(query)
			.populate("studentId", "name rollNo")
			.populate("courseId", "name")
			.sort({ uploadedAt: -1 });

		res.json({ success: true, data: results });
	} catch (err) {
		res.status(500).json({ success: false, error: err.message });
	}
};

exports.updateResult = async (req, res) => {
	try {
		const { marks } = req.body;
		const resultId = req.params.id;

		// Calculate new grade if marks are updated
		const grade = marks ? calculateGrade(marks) : undefined;

		const result = await Result.findByIdAndUpdate(
			resultId,
			{
				...req.body,
				grade,
				uploadedBy: req.user._id,
			},
			{ new: true }
		).populate("studentId courseId");

		if (!result) {
			return res
				.status(404)
				.json({ success: false, error: "Result not found" });
		}

		res.json({ success: true, data: result });
	} catch (err) {
		res.status(500).json({ success: false, error: err.message });
	}
};

exports.deleteResult = async (req, res) => {
	try {
		const result = await Result.findByIdAndDelete(req.params.id);

		if (!result) {
			return res
				.status(404)
				.json({ success: false, error: "Result not found" });
		}

		res.json({ success: true, data: result });
	} catch (err) {
		res.status(500).json({ success: false, error: err.message });
	}
};

exports.downloadResultTemplate = async (req, res) => {
	try {
		// Create a new workbook and worksheet
		const workbook = xlsx.utils.book_new();

		// Define the headers and example data
		const data = [
			{
				studentName: "Student Full Name",
				courseTitle: "Course Name",
				semester: "Semester Number (1-8)",
				marks: "Marks (0-100)",
			},
			{
				studentName: "John Doe",
				courseTitle: "Computer Science",
				semester: "1",
				marks: "85",
			},
		];

		// Create worksheet from data
		const worksheet = xlsx.utils.json_to_sheet(data);

		// Set column widths
		const colWidths = [
			{ wch: 30 }, // studentName
			{ wch: 30 }, // courseTitle
			{ wch: 15 }, // semester
			{ wch: 15 }, // marks
		];
		worksheet["!cols"] = colWidths;

		// Add the worksheet to the workbook
		xlsx.utils.book_append_sheet(workbook, worksheet, "Results Template");

		// Write to buffer
		const excelBuffer = xlsx.write(workbook, {
			bookType: "xlsx",
			type: "buffer",
			bookSST: false,
		});

		// Set response headers
		res.setHeader(
			"Content-Type",
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
		);
		res.setHeader(
			"Content-Disposition",
			"attachment; filename=results_template.xlsx"
		);
		res.setHeader("Content-Length", excelBuffer.length);

		// Send the file
		res.send(excelBuffer);
	} catch (err) {
		console.error("Error generating template:", err);
		res.status(500).json({ success: false, error: err.message });
	}
};

// Helper function to calculate grade based on marks
const calculateGrade = (marks) => {
	if (marks >= 90) return "A+";
	if (marks >= 80) return "A";
	if (marks >= 70) return "B+";
	if (marks >= 60) return "B";
	if (marks >= 50) return "C+";
	if (marks >= 40) return "C";
	if (marks >= 33) return "D";
	return "F";
};

exports.addCourse = async (req, res) => {
	const { name, departmentId, categoryId, feeStructure, formUrl, thumbnailUrl, fileUrl } =
		req.body;
	try {
		// Validate that departmentId and categoryId are provided
		if (!departmentId || !categoryId) {
			return res
				.status(400)
				.json({ success: false, error: "Department ID and Category ID are required" });
		}

		// Verify that the department and category exist
		const department = await Department.findById(departmentId);
		const category = await Category.findById(categoryId);
		if (!department || !category)
			return res
				.status(404)
				.json({ success: false, error: "Department or Category not found" });

		const course = new Course({
			name,
			departmentId,
			categoryId,
			feeStructure,
			formUrl,
			thumbnailUrl,
			fileUrl,
		});
		await course.save();
		res.json({ success: true, data: course });
	} catch (err) {
		console.error("Error adding course:", err);
		res.status(500).json({ success: false, error: err.message });
	}
};

exports.updateCourse = async (req, res) => {
	const { id } = req.params;
	const { name, departmentId, categoryId, feeStructure, formUrl } = req.body;

	try {
		// Validate ObjectId
		if (!mongoose.Types.ObjectId.isValid(id)) {
			return res
				.status(400)
				.json({ success: false, error: "Invalid course ID" });
		}

		// Check if course exists
		const course = await Course.findById(id);
		if (!course) {
			return res
				.status(404)
				.json({ success: false, error: "Course not found" });
		}

		// Update course
		const updatedCourse = await Course.findByIdAndUpdate(
			id,
			{ name, departmentId, categoryId, feeStructure, formUrl },
			{ new: true, runValidators: true }
		);

		// Populate department and category
		await updatedCourse.populate("departmentId categoryId");

		res.json({ success: true, data: updatedCourse });
	} catch (err) {
		console.error("Update course error:", err);
		res.status(500).json({ success: false, error: err.message });
	}
};

exports.deleteCourse = async (req, res) => {
	const { id } = req.params;

	try {
		// Validate ObjectId
		if (!mongoose.Types.ObjectId.isValid(id)) {
			return res
				.status(400)
				.json({ success: false, error: "Invalid course ID" });
		}

		// Check if course exists
		const course = await Course.findById(id);
		if (!course) {
			return res
				.status(404)
				.json({ success: false, error: "Course not found" });
		}

		// Delete course
		await Course.findByIdAndDelete(id);

		res.json({ success: true, message: "Course deleted successfully" });
	} catch (err) {
		console.error("Delete course error:", err);
		res.status(500).json({ success: false, error: err.message });
	}
};

exports.addDepartment = async (req, res) => {
	const { name } = req.body;
	try {
		const department = new Department({ name });
		await department.save();
		res.json({ success: true, data: department });
	} catch (err) {
		res.status(500).json({ success: false, error: err.message });
	}
};

exports.addCategory = async (req, res) => {
	const { name } = req.body;
	try {
		const category = new Category({ name });
		await category.save();
		res.json({ success: true, data: category });
	} catch (err) {
		res.status(500).json({ success: false, error: err.message });
	}
};

exports.addFaculty = async (req, res) => {
	const {
		name,
		email,
		mobile,
		department,
		designation,
		qualification,
		experience,
		password,
	} = req.body;
	try {
		let faculty = await Faculty.findOne({ email });
		if (faculty) {
			return res
				.status(400)
				.json({ success: false, error: "Faculty already exists" });
		}

		faculty = new Faculty({
			name,
			email,
			mobile,
			department,
			designation,
			qualification,
			experience,
			password: await bcrypt.hash(password, 10),
			role: "faculty",
		});

		await faculty.save();

		// Send email notification
		await sendEmail(
			email,
			"Faculty Account Created",
			`Hello ${name}, your faculty account has been created. You can login with your email and password.`
		);

		res.json({ success: true, data: faculty });
	} catch (err) {
		res.status(500).json({ success: false, error: err.message });
	}
};

exports.updateFaculty = async (req, res) => {
	const {
		name,
		email,
		mobile,
		department,
		designation,
		qualification,
		experience,
	} = req.body;
	try {
		const faculty = await Faculty.findByIdAndUpdate(
			req.params.id,
			{
				name,
				email,
				mobile,
				department,
				designation,
				qualification,
				experience,
			},
			{ new: true }
		);

		if (!faculty) {
			return res
				.status(404)
				.json({ success: false, error: "Faculty not found" });
		}

		res.json({ success: true, data: faculty });
	} catch (err) {
		res.status(500).json({ success: false, error: err.message });
	}
};

exports.deleteFaculty = async (req, res) => {
	try {
		const faculty = await Faculty.findByIdAndDelete(req.params.id);

		if (!faculty) {
			return res
				.status(404)
				.json({ success: false, error: "Faculty not found" });
		}

		res.json({
			success: true,
			data: { message: "Faculty deleted successfully" },
		});
	} catch (err) {
		res.status(500).json({ success: false, error: err.message });
	}
};

exports.getAllFaculty = async (req, res) => {
	try {
		const faculty = await Faculty.find().sort({ name: 1 });
		res.json({ success: true, data: faculty });
	} catch (err) {
		res.status(500).json({ success: false, error: err.message });
	}
};

exports.getAllStudents = async (req, res) => {
	try {
		const students = await Student.find({ role: "student" }).sort({ name: 1 });
		res.json({ success: true, data: students });
	} catch (err) {
		res.status(500).json({ success: false, error: err.message });
	}
};

exports.getStudentById = async (req, res) => {
	try {
		const student = await Student.findById(req.params.id);

		if (!student) {
			return res
				.status(404)
				.json({ success: false, error: "Student not found" });
		}

		res.json({ success: true, data: student });
	} catch (err) {
		res.status(500).json({ success: false, error: err.message });
	}
};

exports.updateStudent = async (req, res) => {
	const {
		name,
		email,
		mobile,
		fatherName,
		motherName,
		address,
		city,
		state,
		pinCode,
		dob,
		gender,
		category,
	} = req.body;
	try {
		const student = await Student.findByIdAndUpdate(
			req.params.id,
			{
				name,
				email,
				mobile,
				fatherName,
				motherName,
				address,
				city,
				state,
				pinCode,
				dob,
				gender,
				category,
			},
			{ new: true }
		);

		if (!student) {
			return res
				.status(404)
				.json({ success: false, error: "Student not found" });
		}

		res.json({ success: true, data: student });
	} catch (err) {
		res.status(500).json({ success: false, error: err.message });
	}
};

exports.deleteStudent = async (req, res) => {
	try {
		const student = await Student.findByIdAndDelete(req.params.id);

		if (!student) {
			return res
				.status(404)
				.json({ success: false, error: "Student not found" });
		}

		res.json({
			success: true,
			data: { message: "Student deleted successfully" },
		});
	} catch (err) {
		res.status(500).json({ success: false, error: err.message });
	}
};

exports.sendNotification = async (req, res) => {
	const { userIds, userModel, message, type, emailSubject } = req.body;
	try {
		const notifications = [];

		for (const userId of userIds) {
			// Create in-app notification
			const notification = new Notification({
				userId,
				userModel,
				message,
				type: "in-app",
			});
			await notification.save();
			notifications.push(notification);

			// Send email if requested
			if (type === "email" || type === "both") {
				const Model = userModel === "Faculty" ? Faculty : Student;
				const user = await Model.findById(userId);
				if (user && user.email) {
					await sendEmail(
						user.email,
						emailSubject || "New Notification",
						message
					);
				}
			}
		}

		res.json({ success: true, data: notifications });
	} catch (err) {
		res.status(500).json({ success: false, error: err.message });
	}
};

exports.broadcastNotification = async (req, res) => {
	const { userModel, message, type, emailSubject } = req.body;
	try {
		const Model = userModel === "Faculty" ? Faculty : Student;
		const users = await Model.find();
		const userIds = users.map((user) => user._id);

		const notifications = [];

		for (const userId of userIds) {
			// Create in-app notification
			const notification = new Notification({
				userId,
				userModel,
				message,
				type: "in-app",
			});
			await notification.save();
			notifications.push(notification);
		}

		// Send email if requested
		if (type === "email" || type === "both") {
			for (const user of users) {
				if (user.email) {
					await sendEmail(
						user.email,
						emailSubject || "New Notification",
						message
					);
				}
			}
		}

		res.json({
			success: true,
			data: { message: `Notification sent to ${userIds.length} users` },
		});
	} catch (err) {
		res.status(500).json({ success: false, error: err.message });
	}
};

// File Upload
exports.uploadFile = async (req, res) => {
	try {
		console.log("Upload request received:", req.body);
		console.log("File in request:", req.file);

		if (!req.file) {
			console.error("No file in request");
			return res
				.status(400)
				.json({ success: false, error: "No file uploaded" });
		}

		// Get file information
		const { type, title, description, semester } = req.body;

		// Create file URL
		const fileUrl = `${req.protocol}://${req.get(
			"host"
		)}/uploads/${req.file.destination.split("/").pop()}/${req.file.filename}`;
		console.log("Generated file URL:", fileUrl);

		// Only create document if explicitly requested
		if (req.body.createDocument === "true") {
			// Create document record - use provided title if available
			const document = new Document({
				type: type || "document",
				title: title || req.file.originalname, // Prefer provided title
				description: description || "",
				semester: semester || null,
				fileUrl,
				createdBy: req.user.id,
				updatedAt: Date.now(),
			});

			await document.save();
			console.log("Document saved:", document);

			return res.json({
				success: true,
				data: {
					document,
					fileUrl,
					file: {
						originalName: req.file.originalname,
						filename: req.file.filename,
						mimetype: req.file.mimetype,
						size: req.file.size,
						path: req.file.path,
						destination: req.file.destination,
					},
				},
			});
		}

		// Just return the file URL if no document should be created
		res.json({
			success: true,
			data: {
				fileUrl,
				file: {
					originalName: req.file.originalname,
					filename: req.file.filename,
					mimetype: req.file.mimetype,
					size: req.file.size,
					path: req.file.path,
					destination: req.file.destination,
				},
			},
		});
	} catch (err) {
		console.error("File upload error:", err);
		res.status(500).json({ success: false, error: err.message });
	}
};

// Gallery Image Upload
exports.uploadGalleryImage = async (req, res) => {
	try {
		console.log("Gallery upload request received:", req.body);
		console.log("File in request:", req.file);

		if (!req.file) {
			console.error("No file in request");
			return res
				.status(400)
				.json({ success: false, error: "No file uploaded" });
		}

		// Get gallery-specific information
		const { type, title, description, category, categoryName } = req.body;

		if (!category) {
			return res.status(400).json({ 
				success: false, 
				error: "Gallery category is required" 
			});
		}

		// Create file URL
		const fileUrl = `${req.protocol}://${req.get(
			"host"
		)}/uploads/${req.file.destination.split("/").pop()}/${req.file.filename}`;
		console.log("Generated file URL:", fileUrl);

		// Create gallery document record
		const document = new Document({
			type: "gallery",
			title: title || req.file.originalname.split('.')[0],
			description: description || "",
			category: category,
			categoryName: categoryName || "",
			fileUrl,
			thumbnailUrl: fileUrl, // For images, thumbnail is same as file URL
			createdBy: req.user.id,
			updatedAt: Date.now(),
		});

		await document.save();
		console.log("Gallery document saved:", document);

		return res.json({
			success: true,
			data: {
				document,
				fileUrl,
				file: {
					originalName: req.file.originalname,
					filename: req.file.filename,
					mimetype: req.file.mimetype,
					size: req.file.size,
					path: req.file.path,
					destination: req.file.destination,
				},
			},
		});
	} catch (err) {
		console.error("Gallery upload error:", err);
		res.status(500).json({ success: false, error: err.message });
	}
};

// Payment Management
exports.getPayments = async (req, res) => {
	try {
		const payments = await Payment.find().populate("studentId", "name email");
		res.json({ success: true, data: payments });
	} catch (err) {
		console.error("Error fetching payments:", err);
		res.status(500).json({ success: false, error: err.message });
	}
};

// Notification System
exports.getNotifications = async (req, res) => {
	try {
		const notifications = await Notification.find({
			userModel: "Admin",
			userId: req.user.id,
		}).sort({ createdAt: -1 });

		res.json({ success: true, data: notifications });
	} catch (err) {
		console.error("Error fetching notifications:", err);
		res.status(500).json({ success: false, error: err.message });
	}
};
