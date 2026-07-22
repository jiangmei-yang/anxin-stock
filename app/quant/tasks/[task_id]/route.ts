import {NextResponse} from "next/server";import {getQuantTask} from "@/app/lib/quant-research-server";
export async function GET(_:Request,{params}:{params:Promise<{task_id:string}>}){try{return NextResponse.json({task:await getQuantTask((await params).task_id)});}catch(error){return NextResponse.json({message:error instanceof Error?error.message:"无法读取任务"},{status:404});}}
