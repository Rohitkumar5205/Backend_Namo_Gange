import GalleryImage from "../models/GalleryImageModel.js";
import cloudinary from "../config/cloudinary.js";
import fs from "fs";
import slugify from "../utils/slugify.js";

// ---------------- CREATE ----------------
export const createGallery = async (req, res) => {
  try {
    const { category, status, createdBy, image_alt } = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: "Images missing" });
    }

    // Upload each image to Cloudinary
    const uploadPromises = req.files.map(file => {
      return new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          { folder: "gallery_images" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result.secure_url);
          }
        ).end(file.buffer);
      });
    });

    const imageUrls = await Promise.all(uploadPromises);

    let slug = slugify(category || "gallery-image");
    
    // Check if slug exists to prevent duplicate key error
    let existingSlug = await GalleryImage.findOne({ slug });
    let counter = 1;
    let originalSlug = slug;
    while (existingSlug) {
      slug = `${originalSlug}-${counter}`;
      existingSlug = await GalleryImage.findOne({ slug });
      counter++;
    }

    const galleryImage = await GalleryImage.create({
      category,
      slug,
      status: status || "Active",
      createdBy,
      images: imageUrls.map(url => ({ url, alt: image_alt || "" })),
      image_alt,
    });

    res.status(201).json({
      success: true,
      message: "Gallery images added",
      gallery: galleryImage,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ---------------- GET ALL ----------------
export const getAllGallery = async (req, res) => {
  try {
    const gallery = await GalleryImage.find().sort({
      createdAt: -1,
    });

    res.status(200).json({ success: true, gallery });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ---------------- GET BY ID ----------------
export const getGalleryById = async (req, res) => {
  try {
    const gallery = await GalleryImage.findById(req.params.id);
    if (!gallery)
      return res.status(404).json({ success: false, message: "Not found" });

    res.status(200).json({ success: true, gallery });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ---------------- UPDATE ----------------
export const updateGallery = async (req, res) => {
  try {
    const gallery = await GalleryImage.findById(req.params.id);
    if (!gallery)
      return res.status(404).json({ success: false, message: "Not found" });

    let finalImages = gallery.images;

    // Check for existing images to keep
    if (req.body.existing_images !== undefined) {
      try {
        const existing = typeof req.body.existing_images === "string"
          ? JSON.parse(req.body.existing_images)
          : req.body.existing_images;

        const parsedExisting = Array.isArray(existing) ? existing : [existing];
        finalImages = parsedExisting.map(item => {
          if (typeof item === 'string') return { url: item, alt: req.body.image_alt || "" };
          return item;
        });
      } catch (e) {
        // Fallback if parsing fails
      }
    }

    // Process newly uploaded images
    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map(file => {
        return new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            { folder: "gallery_images" },
            (error, result) => {
              if (error) reject(error);
              else resolve(result.secure_url);
            }
          ).end(file.buffer);
        });
      });
      const newUrls = await Promise.all(uploadPromises);
      const newImageObjects = newUrls.map(url => ({
        url,
        alt: req.body.image_alt || ""
      }));
      finalImages = [...finalImages, ...newImageObjects];
    }

    // Identify images to delete from Cloudinary
    if (gallery.images && gallery.images.length > 0) {
      const imagesToDelete = gallery.images.filter(img =>
        !finalImages.some(fImg => fImg.url === img.url)
      );

      if (imagesToDelete.length > 0) {
        const deletePromises = imagesToDelete.map(img => {
          const imgURL = img.url;
          if (!imgURL) return Promise.resolve();
          const publicId = imgURL.split("/").pop().split(".")[0];
          return cloudinary.uploader.destroy(`gallery_images/${publicId}`);
        });
        await Promise.all(deletePromises);
      }
    }

    // Update metadata
    gallery.category = req.body.category || gallery.category;
    if (req.body.category) {
      let slug = slugify(req.body.category);
      if (slug !== gallery.slug) {
        let existingSlug = await GalleryImage.findOne({ slug, _id: { $ne: gallery._id } });
        let counter = 1;
        let originalSlug = slug;
        while (existingSlug) {
          slug = `${originalSlug}-${counter}`;
          existingSlug = await GalleryImage.findOne({ slug, _id: { $ne: gallery._id } });
          counter++;
        }
        gallery.slug = slug;
      }
    }
    gallery.status = req.body.status || gallery.status;
    gallery.images = finalImages;
    gallery.image_alt = req.body.image_alt || gallery.image_alt;

    const updated = await gallery.save();

    res.status(200).json({
      success: true,
      message: "Gallery updated",
      gallery: updated,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ---------------- DELETE ----------------
export const deleteGallery = async (req, res) => {
  try {
    const gallery = await GalleryImage.findById(req.params.id);
    if (!gallery)
      return res.status(404).json({ success: false, message: "Not found" });

    // Delete all images from Cloudinary
    if (gallery.images && gallery.images.length > 0) {
      const deletePromises = gallery.images.map(img => {
        const imgURL = typeof img === 'string' ? img : img.url;
        if (!imgURL) return Promise.resolve();
        const publicId = imgURL.split("/").pop().split(".")[0];
        return cloudinary.uploader.destroy(`gallery_images/${publicId}`);
      });
      await Promise.all(deletePromises);
    }

    await gallery.deleteOne();

    res.status(200).json({
      success: true,
      message: "Gallery deleted",
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
