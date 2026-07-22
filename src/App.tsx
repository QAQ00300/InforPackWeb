import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { UploadPage } from "@/pages/UploadPage";
import { ReviewPage } from "@/pages/ReviewPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/review/:so_no" element={<ReviewPage />} />
      </Routes>
    </Router>
  );
}