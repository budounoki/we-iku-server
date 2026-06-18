import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md border-2 border-red-100 rounded-[32px] overflow-hidden shadow-xl">
        <CardContent className="pt-12 pb-12 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
            <AlertCircle className="h-10 w-10 text-red-500" />
          </div>
          
          <h1 className="text-2xl font-black text-gray-900 mb-2">
            404 Page Not Found
          </h1>
          <p className="text-gray-500 mb-8 font-medium">
            お探しのページは見つかりませんでした。<br />
            URLが正しいかご確認ください。
          </p>

          <Link href="/">
            <Button className="rounded-2xl h-12 px-8 font-bold">
              ホームに戻る
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
