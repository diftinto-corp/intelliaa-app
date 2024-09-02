import { NextResponse, NextRequest } from "next/server";
import { wsStatusActiveUtil } from "@/lib/actions/intelliaa/assistants";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Lee y parsea el cuerpo de la solicitud
    const body = await req.json();

    const { status: statusRw, service } = body as {
      status: string;
      service: { name: string };
    };

    console.log("Pase por aqui");
    console.log("statusRw", statusRw, "service", service);

    if (statusRw === "SUCCESS") {
      const response = await wsStatusActiveUtil(service.name);
      // Asegurarse de que response es serializable
      if (response && typeof response === "object") {
        return NextResponse.json(response, { status: 200 });
      } else {
        // Transformar response en un objeto serializable si no lo es
        return NextResponse.json({ result: String(response) }, { status: 200 });
      }
    } else {
      return NextResponse.json({ message: "Invalid status" }, { status: 400 });
    }
  } catch (e) {
    console.error("Internal Server Error:", e);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
