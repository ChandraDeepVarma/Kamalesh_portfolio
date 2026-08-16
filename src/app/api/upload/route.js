import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import clientPromise from "@/lib/mongodb";

if (process.env.CLOUDINARY_URL) {
  cloudinary.config({ secure: true });
} else {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export async function POST(request) {
  try {
    // Auth Check
    const cookieStore = await cookies();
    const session = cookieStore.get("portfolio_admin_session");

    if (!session || session.value !== "session_authenticated_alex_morgan") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Convert file to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const isImage = file.type.startsWith("image/");

    if (!isImage) {
      // Save directly to MongoDB uploads collection
      const client = await clientPromise;
      const db = client.db("portfolio");
      
      await db.collection("uploads").replaceOne(
        { _id: "resume_pdf" },
        {
          _id: "resume_pdf",
          data: buffer,
          filename: file.name,
          mimeType: file.type,
          uploadedAt: new Date()
        },
        { upsert: true }
      );

      return NextResponse.json({
        success: true,
        url: "/api/resume/download",
        public_id: "resume_pdf"
      });
    }

    const resourceType = "image";
    const uploadOptions = {
      resource_type: resourceType,
      folder: "portfolio",
      use_filename: true,
      unique_filename: true,
    };

    // Upload to Cloudinary using standard stream
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      ).end(buffer);
    });

    return NextResponse.json({
      success: true,
      url: uploadResult.secure_url,
      public_id: uploadResult.public_id,
    });
  } catch (error) {
    console.error("Error in upload API:", error);
    return NextResponse.json({ error: "Failed to upload file to Cloudinary" }, { status: 500 });
  }
}
