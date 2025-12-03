import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Poll from "@/models/Poll";

export async function DELETE(req: NextRequest, { params }: { params: { pollId: string } }) {
  await dbConnect();

  try {
    const pollId = params.pollId;

    const deleted = await Poll.findOneAndDelete({ pollId });

    if (!deleted) {
      return NextResponse.json(
        { success: false, message: "Poll not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, message: "Poll deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Delete Poll Error:", error);
    return NextResponse.json(
      { success: false, message: "Server Error" },
      { status: 500 }
    );
  }
}
