import React from "react";
import Link from "next/link";
function LandingPage() {
  return (
    <div className="flex justify-center min-h-[calc(100vh-4rem)] items-center w-full text-white">

      <main className="md:mx-auto md:px-6 md:py-20 py-10 text-center">
        <h1 className="md:text-5xl text-3xl font-bold mb-6 bg-gradient-to-r from-purple-500 p-4 to-blue-800 bg-clip-text text-transparent">
          AI Chatbot with Intelligence
        </h1>

        <p className="text-gray-400 md:max-w-2xl text-2xl mx-auto mb-10">
          Chat with AI or upload a document and ask questions , Do web search .
        </p>

        <div className="flex justify-center gap-6">
          <Link  href="/chat" className="md:px-6 px-3 py-2 cursor-pointer md:py-3 bg-gradient-to-r from-purple-800 to-blue-800 rounded-lg font-semibold hover:opacity-90">
            Start Chat
          </Link>
        </div>
      </main>
    </div>
  );
}

export default LandingPage;
