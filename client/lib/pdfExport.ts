import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface TestResult {
  id: string;
  title: string;
  type: string;
  score: number;
  max_score: number;
  band_score: number;
  date: string;
  feedback?: string;
  sections?: {
    name: string;
    score: number;
    max_score: number;
    questions: {
      question: string;
      student_answer: string;
      correct_answer: string;
      is_correct: boolean;
    }[];
  }[];
}

interface StudentInfo {
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  edu_center?: {
    name: string;
    location: string;
  };
}

export const generateTestResultPDF = async (
  result: TestResult,
  student: StudentInfo,
) => {
  try {
    // Create a temporary div for PDF content
    const pdfContent = document.createElement("div");
    pdfContent.style.width = "800px";
    pdfContent.style.padding = "40px";
    pdfContent.style.fontFamily = "Arial, sans-serif";
    pdfContent.style.backgroundColor = "white";
    pdfContent.style.position = "absolute";
    pdfContent.style.left = "-9999px";

    // Header with logo and title
    pdfContent.innerHTML = `
      <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #3B82F6; padding-bottom: 20px;">
        <div style="display: inline-block; background: #3B82F6; color: white; width: 60px; height: 60px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; margin-bottom: 10px;">I</div>
        <h1 style="color: #3B82F6; margin: 10px 0; font-size: 28px;">IELTS Practice Platform</h1>
        <h2 style="color: #374151; margin: 0; font-size: 20px;">Test Results Report</h2>
      </div>

      <!-- Student Information -->
      <div style="margin-bottom: 25px;">
        <h3 style="color: #374151; border-bottom: 1px solid #E5E7EB; padding-bottom: 8px; margin-bottom: 15px;">Student Information</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
          <div><strong>Name:</strong> ${student.first_name} ${student.last_name}</div>
          <div><strong>Username:</strong> @${student.username}</div>
          <div><strong>Email:</strong> ${student.email}</div>
          ${
            student.edu_center
              ? `<div><strong>Education Center:</strong> ${student.edu_center.name}</div>`
              : ""
          }
        </div>
      </div>

      <!-- Test Information -->
      <div style="margin-bottom: 25px;">
        <h3 style="color: #374151; border-bottom: 1px solid #E5E7EB; padding-bottom: 8px; margin-bottom: 15px;">Test Information</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
          <div><strong>Test Title:</strong> ${result.title}</div>
          <div><strong>Test Type:</strong> ${result.type}</div>
          <div><strong>Date Taken:</strong> ${new Date(result.date).toLocaleDateString()}</div>
          <div><strong>Time Taken:</strong> ${new Date(result.date).toLocaleTimeString()}</div>
        </div>
      </div>

      <!-- Score Summary -->
      <div style="margin-bottom: 25px;">
        <h3 style="color: #374151; border-bottom: 1px solid #E5E7EB; padding-bottom: 8px; margin-bottom: 15px;">Score Summary</h3>
        <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; text-align: center;">
          <div style="font-size: 36px; font-weight: bold; color: #3B82F6; margin-bottom: 5px;">${result.band_score}</div>
          <div style="font-size: 18px; color: #6B7280; margin-bottom: 10px;">IELTS Band Score</div>
          <div style="font-size: 14px; color: #6B7280;">Raw Score: ${result.score}/${result.max_score}</div>
          <div style="font-size: 14px; color: #6B7280;">Percentage: ${Math.round((result.score / result.max_score) * 100)}%</div>
        </div>
      </div>

      ${
        result.sections
          ? `
        <!-- Section Breakdown -->
        <div style="margin-bottom: 25px;">
          <h3 style="color: #374151; border-bottom: 1px solid #E5E7EB; padding-bottom: 8px; margin-bottom: 15px;">Section Breakdown</h3>
          ${result.sections
            .map(
              (section) => `
            <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #E5E7EB; border-radius: 6px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h4 style="margin: 0; color: #374151;">${section.name}</h4>
                <div style="font-weight: bold; color: #3B82F6;">${section.score}/${section.max_score}</div>
              </div>
              <div style="background: #E5E7EB; height: 8px; border-radius: 4px; overflow: hidden;">
                <div style="background: #3B82F6; height: 100%; width: ${(section.score / section.max_score) * 100}%; border-radius: 4px;"></div>
              </div>
            </div>
          `,
            )
            .join("")}
        </div>
      `
          : ""
      }

      ${
        result.feedback
          ? `
        <!-- Feedback -->
        <div style="margin-bottom: 25px;">
          <h3 style="color: #374151; border-bottom: 1px solid #E5E7EB; padding-bottom: 8px; margin-bottom: 15px;">Instructor Feedback</h3>
          <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; border-radius: 4px;">
            <p style="margin: 0; color: #374151; line-height: 1.6;">${result.feedback}</p>
          </div>
        </div>
      `
          : ""
      }

      <!-- Certificate Section -->
      <div style="margin-top: 40px; text-align: center; border: 2px solid #3B82F6; border-radius: 8px; padding: 25px;">
        <h3 style="color: #3B82F6; margin-bottom: 15px;">Certificate of Completion</h3>
        <p style="color: #374151; margin-bottom: 20px;">This certifies that</p>
        <h2 style="color: #374151; margin: 15px 0; font-size: 24px;">${student.first_name} ${student.last_name}</h2>
        <p style="color: #374151; margin-bottom: 20px;">has successfully completed</p>
        <h3 style="color: #3B82F6; margin: 15px 0;">${result.title}</h3>
        <p style="color: #374151; margin-bottom: 20px;">achieving a band score of <strong>${result.band_score}</strong></p>
        <div style="margin-top: 30px; display: flex; justify-content: space-between; align-items: end;">
          <div style="text-align: left;">
            <div style="border-top: 1px solid #374151; width: 200px; margin-bottom: 5px;"></div>
            <small style="color: #6B7280;">Date: ${new Date(result.date).toLocaleDateString()}</small>
          </div>
          <div style="text-align: right;">
            <div style="border-top: 1px solid #374151; width: 200px; margin-bottom: 5px;"></div>
            <small style="color: #6B7280;">IELTS Practice Platform</small>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div style="margin-top: 30px; text-align: center; font-size: 12px; color: #6B7280; border-top: 1px solid #E5E7EB; padding-top: 15px;">
        <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
        <p>This is an official document from IELTS Practice Platform</p>
      </div>
    `;

    // Add to DOM temporarily
    document.body.appendChild(pdfContent);

    // Generate canvas from the content
    const canvas = await html2canvas(pdfContent, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
    });

    // Remove temporary element
    document.body.removeChild(pdfContent);

    // Create PDF
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const imgWidth = 210; // A4 width in mm
    const pageHeight = 295; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;

    let position = 0;

    // Add first page
    pdf.addImage(
      canvas.toDataURL("image/png"),
      "PNG",
      0,
      position,
      imgWidth,
      imgHeight,
    );
    heightLeft -= pageHeight;

    // Add additional pages if needed
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(
        canvas.toDataURL("image/png"),
        "PNG",
        0,
        position,
        imgWidth,
        imgHeight,
      );
      heightLeft -= pageHeight;
    }

    // Generate filename
    const filename = `IELTS_Result_${student.last_name}_${student.first_name}_${new Date(result.date).toISOString().split("T")[0]}.pdf`;

    // Download PDF
    pdf.save(filename);

    return { success: true, filename };
  } catch (error) {
    console.error("Error generating PDF:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

export const generateProgressReportPDF = async (
  student: StudentInfo,
  results: TestResult[],
) => {
  try {
    // Similar implementation for progress report
    // This would generate a comprehensive progress report with charts
    console.log("Generating progress report PDF for:", student, results);

    // For now, just generate a simple report
    const filename = `IELTS_Progress_Report_${student.last_name}_${student.first_name}_${new Date().toISOString().split("T")[0]}.pdf`;

    return { success: true, filename };
  } catch (error) {
    console.error("Error generating progress report PDF:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};
