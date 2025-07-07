const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure upload directories exist
const createDirIfNotExists = (dir) => {
	try {
		if (!fs.existsSync(dir)) {
			console.log(`Creating directory: ${dir}`);
			fs.mkdirSync(dir, { recursive: true });
		}
	} catch (error) {
		console.error(`Error creating directory ${dir}:`, error);
	}
};

// Create upload directories
createDirIfNotExists("uploads");
createDirIfNotExists("uploads/documents");
createDirIfNotExists("uploads/gallery");
createDirIfNotExists("uploads/profiles");
createDirIfNotExists("uploads/results");

// File filter to validate file types
const fileFilter = (req, file, cb) => {
	console.log("Received file:", file.originalname, file.mimetype);
	const type = req.body.type || "document";
	console.log("Content type:", type);

	// Define allowed file types for different content types
	const allowedTypes = {
		gallery: ["image/jpeg", "image/png", "image/gif", "image/webp"],
		about: ["image/jpeg", "image/png", "image/gif", "image/webp"],
		news: ["image/jpeg", "image/png", "image/gif", "image/webp"],
		event: ["image/jpeg", "image/png", "image/gif", "image/webp"],
		profile: ["image/jpeg", "image/png", "image/gif", "image/webp"],
		syllabus: [
			"application/pdf",
			"application/msword",
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		],
		datesheet: [
			"application/pdf",
			"application/msword",
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			"application/vnd.ms-excel",
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		],
		result: [
			"application/vnd.ms-excel",
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		],
		form: ["application/pdf"],
		document: [
			"application/pdf",
			"application/msword",
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			"application/vnd.ms-excel",
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			"image/jpeg",
			"image/png",
		],
	};

	// Get allowed mime types for the current content type
	const allowed = allowedTypes[type] || allowedTypes.document;

	if (allowed.includes(file.mimetype)) {
		console.log("File type allowed:", file.mimetype);
		cb(null, true);
	} else {
		console.error("Invalid file type:", file.mimetype);
		cb(
			new Error(
				`Invalid file type. Only ${allowed
					.map((type) => type.split("/")[1].toUpperCase())
					.join(", ")} files are allowed for ${type} uploads.`
			),
			false
		);
	}
};

// Configure disk storage
const diskStorage = multer.diskStorage({
	destination: (req, file, cb) => {
		const type = req.body.type || "document";
		let uploadPath = "uploads/documents";

		if (
			type === "gallery" ||
			type === "about" ||
			type === "news" ||
			type === "event"
		) {
			uploadPath = "uploads/gallery";
		} else if (type === "profile") {
			uploadPath = "uploads/profiles";
		} else if (type === "result") {
			uploadPath = "uploads/results";
		}

		// Ensure the directory exists
		createDirIfNotExists(uploadPath);

		console.log(`Storing file in: ${uploadPath}`);
		cb(null, uploadPath);
	},
	filename: (req, file, cb) => {
		const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
		const fileExt = path.extname(file.originalname);
		const sanitizedName = path
			.basename(file.originalname, fileExt)
			.replace(/[^a-zA-Z0-9]/g, "-")
			.toLowerCase();

		const filename = sanitizedName + "-" + uniqueSuffix + fileExt;
		console.log(`Generated filename: ${filename}`);
		cb(null, filename);
	},
});

// Create multer instances
const uploadWithDiskStorage = multer({
	storage: diskStorage,
	fileFilter: fileFilter,
	limits: {
		fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // Default to 10MB if not specified
	},
});

const uploadWithMemoryStorage = multer({
	storage: multer.memoryStorage(),
	fileFilter: fileFilter,
	limits: {
		fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024,
	},
});

// Export both configurations
module.exports = {
	single: uploadWithDiskStorage.single.bind(uploadWithDiskStorage),
	array: uploadWithDiskStorage.array.bind(uploadWithDiskStorage),
	fields: uploadWithDiskStorage.fields.bind(uploadWithDiskStorage),
	memory: {
		single: uploadWithMemoryStorage.single.bind(uploadWithMemoryStorage),
		array: uploadWithMemoryStorage.array.bind(uploadWithMemoryStorage),
		fields: uploadWithMemoryStorage.fields.bind(uploadWithMemoryStorage),
	}
};
