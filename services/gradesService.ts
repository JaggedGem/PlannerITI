/**
 * Service for interacting with the CEITI grades API
 */

// Login URL for authentication with IDNP
const LOGIN_URL = 'https://api.ceiti.md/date/login';
// Info URL for retrieving student data
const INFO_URL = 'https://api.ceiti.md/index.php/date/info/';

/**
 * Sends a login request with the student's IDNP to the CEITI API
 * @param idnp The student's IDNP (13 digits)
 * @returns Promise with the login response
 */
export const loginWithIdnp = async (idnp: string): Promise<any> => {
  try {
    const response = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `idnp=${idnp}`,
    });
    
    if (!response.ok) {
      throw new Error(`Login failed with status: ${response.status}`);
    }
    
    return await response.text();
  } catch (error) {
    // Silently handle errors
    throw error;
  }
};

/**
 * Fetches the student's grade information using their IDNP
 * @param idnp The student's IDNP (13 digits)
 * @returns Promise with the student's grade information
 */
export const fetchStudentInfo = async (idnp: string): Promise<string> => {
  try {
    // First login with the IDNP
    await loginWithIdnp(idnp);
    
    // Then fetch the student info
    const infoResponse = await fetch(`${INFO_URL}${idnp}`, {
      method: 'GET',
    });
    
    if (!infoResponse.ok) {
      throw new Error(`Failed to get student info with status: ${infoResponse.status}`);
    }
    
    return await infoResponse.text();
  } catch (error) {
    // Silently handle errors
    throw error;
  }
};

// Interfaces for parsed data
export interface StudentInfo {
  name: string;
  firstName: string;
  patronymic: string;
  studyYear: string;
  group: string;
  specialization: string;
  curator?: string;
  departmentHead?: string;
  status?: string;
}

export interface GradeSubject {
  name: string;
  grades: string[];
  average?: number;
  displayedAverage?: string;
}

export interface SemesterGrades {
  semester: number;
  subjects: GradeSubject[];
  absences?: {
    total: number;
    sick: number;
    excused: number;
    unexcused: number;
  };
}

export interface Exam {
  name: string;
  type: string; // "Examen" | "Teza" | "Practică"
  grade: string;
  semester: number;
}

export interface AnnualGrade {
  subject: string;
  semester1Grade?: string;
  semester2Grade?: string;
  annualGrade?: string;
  evaluationGrade?: string;
  evaluationType?: string;
}

export interface StudentGrades {
  studentInfo: StudentInfo;
  currentGrades: SemesterGrades[];
  exams: Exam[];
  annualGrades: AnnualGrade[];
  currentSemester?: number;
}

/**
 * Extracts the numeric value from a grade string
 * @param gradeStr The grade string (e.g. "9.5", "9,5", "9")
 * @returns The numeric value or NaN if not a valid grade
 */
const parseGrade = (gradeStr: string): number => {
  if (!gradeStr) return NaN;
  
  // Replace commas with dots for decimal values
  const cleanedStr = gradeStr.trim().replace(',', '.');
  
  // Check if this is a valid numeric grade
  if (/^[0-9]+(\.[0-9]+)?$/.test(cleanedStr)) {
    return parseFloat(cleanedStr);
  }
  
  return NaN;
};

/**
 * Calculate the average of grades from an array of grade strings
 * @param grades Array of grade strings
 * @returns The average value or undefined if no valid grades
 */
const calculateAverage = (grades: string[]): number | undefined => {
  // Filter out non-numeric grades (like "a", "m" etc.)
  const validGrades = grades
    .map(g => parseGrade(g))
    .filter(g => !isNaN(g));
  
  if (validGrades.length === 0) return undefined;
  
  const sum = validGrades.reduce((acc, grade) => acc + grade, 0);
  // Round DOWN to 2 decimal places (Math.floor with multiplier) instead of using toFixed which rounds
  return Math.floor((sum / validGrades.length) * 100) / 100;
};

/**
 * Extract data from HTML using regex pattern for table rows
 * @param html HTML content
 * @param tableId ID of the table to search within
 * @param labelPattern Pattern to match the label
 * @returns Extracted value or empty string
 */
const extractTableValue = (html: string, tableId: string, labelPattern: string): string => {
  // Create a regex pattern to find the matching row in the table
  const pattern = new RegExp(`<table[^>]*id=["']${tableId}["'][^>]*>.*?<tr[^>]*>\\s*<th[^>]*>${labelPattern}<\\/th>\\s*<td[^>]*>\\s*([^<]+)\\s*<\\/td>\\s*<\\/tr>`, 's');
  const match = html.match(pattern);
  return match ? match[1].trim() : '';
};

/**
 * Parse student personal information from the HTML response using regex
 * @param html The HTML response from the API
 * @returns Student info object
 */
const parseStudentInfo = (html: string): StudentInfo => {
  console.log("Parsing student info...");
  
  try {
    // Extract from date-personale table
    const namePattern = /<tr>\s*<th>Numele<\/th>\s*<td>([^<]+)<\/td>\s*<\/tr>/;
    const firstNamePattern = /<tr>\s*<th>Prenumele<\/th>\s*<td>([^<]+)<\/td>\s*<\/tr>/;
    const patronymicPattern = /<tr>\s*<th>Patronimicul<\/th>\s*<td>([^<]+)<\/td>\s*<\/tr>/;
    const studyYearPattern = /<tr>\s*<th>Anul de studii<\/th>\s*<td>([^<]+)<\/td>\s*<\/tr>/;
    const groupPattern = /<tr>\s*<th>Grupa<\/th>\s*<td>([^<]+)<\/td>\s*<\/tr>/;
    const specPattern = /<tr>\s*<th>Specialitatea<\/th>\s*<td>([^<]+)<\/td>\s*<\/tr>/;
    const curatorPattern = /<tr>\s*<th>Diriginte<\/th>\s*<td>([^<]+)<\/td>\s*<\/tr>/;
    const deptHeadPattern = /<tr>\s*<th>Șef secție<\/th>\s*<td>([^<]+)<\/td>\s*<\/tr>/;
    const statusPattern = /<tr>\s*<th>Statut<\/th>\s*<td>([^<]+)<\/td>\s*<\/tr>/;
    
    const nameMatch = html.match(namePattern);
    const firstNameMatch = html.match(firstNamePattern);
    const patronymicMatch = html.match(patronymicPattern);
    const studyYearMatch = html.match(studyYearPattern);
    const groupMatch = html.match(groupPattern);
    const specMatch = html.match(specPattern);
    const curatorMatch = html.match(curatorPattern);
    const deptHeadMatch = html.match(deptHeadPattern);
    const statusMatch = html.match(statusPattern);
    
    return {
      name: nameMatch ? nameMatch[1].trim() : "Unknown",
      firstName: firstNameMatch ? firstNameMatch[1].trim() : "Student",
      patronymic: patronymicMatch ? patronymicMatch[1].trim() : "",
      studyYear: studyYearMatch ? studyYearMatch[1].trim() : "",
      group: groupMatch ? groupMatch[1].trim() : "",
      specialization: specMatch ? specMatch[1].trim() : "",
      curator: curatorMatch ? curatorMatch[1].trim() : undefined,
      departmentHead: deptHeadMatch ? deptHeadMatch[1].trim() : undefined,
      status: statusMatch ? statusMatch[1].trim() : undefined
    };
  } catch (error) {
    console.error("Error parsing student info:", error);
    return {
      name: "Error",
      firstName: "Loading",
      patronymic: "",
      studyYear: "",
      group: "Failed to parse",
      specialization: ""
    };
  }
};

/**
 * Create a simple mock data for testing
 * @returns Mock student grades data
 */
const createMockData = (): StudentGrades => {
  return {
    studentInfo: {
      name: "Demo",
      firstName: "Student",
      patronymic: "",
      studyYear: "2023-2024",
      group: "S-01",
      specialization: "Software Development"
    },
    currentGrades: [
      {
        semester: 1,
        subjects: [
          {
            name: "Mathematics",
            grades: ["9", "8", "10", "9"],
            average: 9,
            displayedAverage: "9.00"
          },
          {
            name: "Programming",
            grades: ["10", "10", "9", "10"],
            average: 9.75,
            displayedAverage: "9.75"
          },
          {
            name: "English",
            grades: ["8", "9", "8"],
            average: 8.33,
            displayedAverage: "8.33"
          }
        ],
        absences: {
          total: 5,
          sick: 2,
          excused: 2,
          unexcused: 1
        }
      }
    ],
    exams: [
      {
        name: "Mathematics Final",
        type: "Examen",
        grade: "9",
        semester: 1
      },
      {
        name: "Programming Project",
        type: "Practică",
        grade: "10",
        semester: 1
      }
    ],
    annualGrades: [],
    currentSemester: 1
  };
};

/**
 * Extract all matches from an HTML string using a regex pattern
 * @param html The HTML string to search in
 * @param pattern The regex pattern to match
 * @returns Array of matches
 */
const extractAllMatches = (html: string, pattern: RegExp): RegExpMatchArray[] => {
  const matches: RegExpMatchArray[] = [];
  let match;
  
  // Create a copy of the regexp to avoid lastIndex issues
  const regex = new RegExp(pattern.source, pattern.flags);
  
  while ((match = regex.exec(html)) !== null) {
    matches.push(match);
    // Avoid infinite loops with zero-width matches
    if (match.index === regex.lastIndex) {
      regex.lastIndex++;
    }
  }
  
  return matches;
};

/**
 * Parse current semester grades from the HTML response using regex
 * @param html The HTML response from the API
 * @returns Array of semester grades objects
 */
const parseCurrentGrades = (html: string): SemesterGrades[] => {
  const result: SemesterGrades[] = [];
  
  try {
    console.log("Starting to parse current grades");
    
    // Extract the situatia-curenta section
    const situatiaCurentaPattern = /<div[^>]*id="situatia-curenta"[^>]*>(.*?)<div[^>]*id="note-1"/s;
    const situatiaCurentaMatch = html.match(situatiaCurentaPattern);
    
    if (!situatiaCurentaMatch) {
      console.log("Could not find situatia-curenta section");
      return createFallbackSemesters();
    }
    
    const situatiaCurentaContent = situatiaCurentaMatch[1];
    
    // Extract the semester headers and panel IDs
    const semesterHeadersPattern = /<h4[^>]*class="panel-title"[^>]*>[\s\n]*<a[^>]*>[^<]*Semestrul\s+([IVX]+|[0-9]+)[^<]*<\/a>[\s\n]*<\/h4>[\s\n]*<\/div>[\s\n]*<div[^>]*id="collaps3e(\d+)"/gi;
    const headerMatches = [];
    let headerMatch;
    while ((headerMatch = semesterHeadersPattern.exec(situatiaCurentaContent)) !== null) {
      headerMatches.push({
        semesterText: headerMatch[1].trim(),
        panelId: headerMatch[2]
      });
    }
    
    console.log(`Found ${headerMatches.length} semester headers`);
    
    // If no headers found, try a fallback approach
    if (headerMatches.length === 0) {
      return handleFallbackParsing(situatiaCurentaContent);
    }

    // For each semester header, find its content panel and parse subjects
    headerMatches.forEach((header, index) => {
      const panelId = header.panelId;
      const semesterText = header.semesterText;
      
      // Convert Roman numerals or digits to semester number
      let semesterNumber: number;
      if (semesterText === 'I') {
        semesterNumber = 1;
      } else if (semesterText === 'II') {
        semesterNumber = 2;
      } else if (semesterText === 'III') {
        semesterNumber = 3;
      } else if (semesterText === 'IV') {
        semesterNumber = 4;
      } else if (/^\d+$/.test(semesterText)) {
        semesterNumber = parseInt(semesterText, 10);
      } else {
        // Default to index + 1 (1-based) if we can't parse
        semesterNumber = index + 1;
      }
      
      console.log(`Processing semester ${semesterNumber} (${semesterText}), panel ID: ${panelId}`);
      
      // Extract the panel content using the panel ID
      const panelPattern = new RegExp(`<div[^>]*id="collaps3e${panelId}"[^>]*>(.*?)<\\/div>\\s*<\\/div>\\s*<\\/div>`, 's');
      const panelMatch = situatiaCurentaContent.match(panelPattern);
      
      if (!panelMatch) {
        console.log(`Could not find panel content for semester ${semesterNumber}`);
        return;
      }
      
      const panelContent = panelMatch[1];
      
      // Create a new semester object
      const semester: SemesterGrades = {
        semester: semesterNumber,
        subjects: []
      };
      
      // Extract the table rows for subjects and grades
      parseSubjectsFromPanel(panelContent, semester);
      
      // Parse absences
      parseAbsencesFromPanel(panelContent, semester);
      
      // Add semester to result
      result.push(semester);
    });
    
    // If no complete semesters were found, try simpler fallback
    if (result.length === 0 || !result.some(s => s.subjects.length > 0)) {
      console.log("No valid semesters with subjects found, using fallback approach");
      return createFallbackSemesters();
    }
    
    // Ensure both semester I and semester II are present
    if (result.length === 1) {
      const existingSemesterNumber = result[0].semester;
      if (existingSemesterNumber === 1) {
        // Add an empty semester II
        result.push({
          semester: 2,
          subjects: [{
            name: "No subjects available for Semester II",
            grades: [],
            displayedAverage: "-"
          }]
        });
      } else if (existingSemesterNumber === 2) {
        // Add an empty semester I and reorder
        result.unshift({
          semester: 1,
          subjects: [{
            name: "No subjects available for Semester I",
            grades: [],
            displayedAverage: "-"
          }]
        });
      }
    }
    
    // Sort semesters by number to ensure proper order
    result.sort((a, b) => a.semester - b.semester);
    
    console.log(`Final parsed semesters count: ${result.length}`);
    return result;
  } catch (error) {
    console.error("Error parsing current grades:", error);
    return createFallbackSemesters();
  }
};

/**
 * Helper function to parse subjects from a panel
 * @param panelContent The HTML content of the panel
 * @param semester The semester object to populate
 */
const parseSubjectsFromPanel = (panelContent: string, semester: SemesterGrades): void => {
  // First try with <p> tags inside <td>
  let tableRowPattern = /<tr>\s*<td>\s*<p>(.*?)<\/p>\s*<\/td>\s*<td>\s*<p>(.*?)<\/p>\s*<\/td>\s*<\/tr>/gs;
  let rowMatch;
  let foundSubjects = false;
  
  // Store subject names to prevent duplicates within the same semester
  const subjectNames = new Set<string>();
  
  while ((rowMatch = tableRowPattern.exec(panelContent)) !== null) {
    const subjectName = rowMatch[1].trim();
    const gradesText = rowMatch[2].trim();
    
    // Skip header rows, absence rows, and duplicate subjects
    if (subjectName === "Denumire" || 
        subjectName === "Semestrul II" || 
        subjectName.toLowerCase().includes("absențe") || 
        subjectName === "Note" ||
        subjectName === "Denumirea Obiectelor" ||
        subjectNames.has(subjectName)) {
      continue;
    }
    
    // Add to tracked subjects
    subjectNames.add(subjectName);
    
    // Parse grades - handle both comma and space separated values
    // First clean up by removing any HTML tags that might be present
    const cleanGradesText = gradesText.replace(/<[^>]*>/g, '');
    
    // Split using both comma and space as separators
    // Then filter out non-numeric grades like 'm', 'a', etc.
    const grades = cleanGradesText
      ? cleanGradesText
          .split(/[,\s]+/)
          .map(g => g.trim())
          .filter(g => {
            // Keep only valid numeric grades (integer or with decimal)
            return g.length > 0 && /^\d+([.,]\d+)?$/.test(g);
          })
      : [];
    
    const average = calculateAverage(grades);
    
    semester.subjects.push({
      name: subjectName,
      grades,
      average,
      displayedAverage: average ? average.toFixed(2) : '-'
    });
    
    foundSubjects = true;
  }
  
  // If no subjects found with <p> tags, try without them
  if (!foundSubjects) {
    tableRowPattern = /<tr>\s*<td>\s*(.*?)\s*<\/td>\s*<td>\s*(.*?)\s*<\/td>\s*<\/tr>/gs;
    
    while ((rowMatch = tableRowPattern.exec(panelContent)) !== null) {
      const subjectName = rowMatch[1].replace(/<[^>]*>/g, '').trim();
      const gradesText = rowMatch[2].replace(/<[^>]*>/g, '').trim();
      
      // Skip header rows, absence rows, and duplicate subjects
      if (subjectName === "Denumire" || 
          subjectName === "Semestrul II" || 
          subjectName.toLowerCase().includes("absențe") || 
          subjectName === "Note" ||
          subjectName === "Denumirea Obiectelor" ||
          subjectNames.has(subjectName)) {
        continue;
      }
      
      // Add to tracked subjects
      subjectNames.add(subjectName);
      
      // Parse grades - filter out non-numeric values
      const grades = gradesText
        ? gradesText
            .split(/[,\s]+/)
            .map(g => g.trim())
            .filter(g => {
              // Keep only valid numeric grades (integer or with decimal)
              return g.length > 0 && /^\d+([.,]\d+)?$/.test(g);
            })
        : [];
      
      const average = calculateAverage(grades);
      
      semester.subjects.push({
        name: subjectName,
        grades,
        average,
        displayedAverage: average ? average.toFixed(2) : '-'
      });
    }
  }
};

/**
 * Helper function to parse absences from a panel
 * @param panelContent The HTML content of the panel
 * @param semester The semester object to populate
 */
const parseAbsencesFromPanel = (panelContent: string, semester: SemesterGrades): void => {
  const absencesTotalPattern = /<tr>\s*<th>Absențe totale<\/th>\s*<th>(\d+)\s*<\/th>\s*<\/tr>/;
  const absencesTotalMatch = panelContent.match(absencesTotalPattern);
  
  if (absencesTotalMatch) {
    const total = parseInt(absencesTotalMatch[1].trim(), 10);
    
    // Check for other absence details
    const absencesSickPattern = /<tr>\s*<td><i>Bolnav<\/i><\/td>\s*<td><i>(\d+)<\/i><\/td>\s*<\/tr>/;
    const absencesMotivatePattern = /<tr>\s*<td><i>Motivate<\/i><\/td>\s*<td><i>(\d+)<\/i><\/td>\s*<\/tr>/;
    const absencesNemotivatePattern = /<tr>\s*<td><i>Nemotivate<\/i><\/td>\s*<td><i>(\d+)<\/i><\/td>\s*<\/tr>/;
    
    const sickMatch = panelContent.match(absencesSickPattern);
    const motivateMatch = panelContent.match(absencesMotivatePattern);
    const nemotivateMatch = panelContent.match(absencesNemotivatePattern);
    
    semester.absences = {
      total,
      sick: sickMatch ? parseInt(sickMatch[1].trim(), 10) : 0,
      excused: motivateMatch ? parseInt(motivateMatch[1].trim(), 10) : 0,
      unexcused: nemotivateMatch ? parseInt(nemotivateMatch[1].trim(), 10) : 0
    };
  }
};

/**
 * Fallback function for parsing when normal parsing fails
 * @param situatiaCurentaContent The HTML content of the situatia-curenta section
 * @returns Array of semester grades objects
 */
const handleFallbackParsing = (situatiaCurentaContent: string): SemesterGrades[] => {
  console.log("Using fallback approach to find semesters");
  const result: SemesterGrades[] = [];
  
  // Try to find any semestral data by direct content search
  const semester1Pattern = /Semestrul\s+I|Semestrul\s+1/i;
  const semester2Pattern = /Semestrul\s+II|Semestrul\s+2/i;
  
  const hasSemester1 = semester1Pattern.test(situatiaCurentaContent);
  const hasSemester2 = semester2Pattern.test(situatiaCurentaContent);
  
  console.log(`Fallback detection: Semester I: ${hasSemester1}, Semester II: ${hasSemester2}`);
  
  // Create empty semesters
  if (hasSemester1) {
    result.push({
      semester: 1,
      subjects: []
    });
  }
  
  if (hasSemester2) {
    result.push({
      semester: 2,
      subjects: []
    });
  }
  
  // If we found some semesters but couldn't parse them properly, return with default subjects
  if (result.length > 0) {
    result.forEach(semester => {
      if (semester.subjects.length === 0) {
        semester.subjects.push({
          name: `Data available for Semester ${semester.semester} but couldn't be parsed`,
          grades: [],
          displayedAverage: '-'
        });
      }
    });
    return result;
  }
  
  // If all else fails, create default semesters
  return createFallbackSemesters();
};

/**
 * Creates fallback semester data when parsing fails
 * @returns Default semester data
 */
const createFallbackSemesters = (): SemesterGrades[] => {
  return [
    {
      semester: 1,
      subjects: [{
        name: "Semester I data not available",
        grades: [],
        displayedAverage: "-"
      }]
    },
    {
      semester: 2,
      subjects: [{
        name: "Semester II data not available",
        grades: [],
        displayedAverage: "-"
      }]
    }
  ];
};

/**
 * Parse exams, thesis and practice grades from the HTML response using regex
 * @param html The HTML response from the API
 * @returns Array of exam objects
 */
const parseExams = (html: string): Exam[] => {
  const result: Exam[] = [];
  
  try {
    // Find the note-1 section which contains exams
    const note1Section = html.match(/<div[^>]*id="note-1"[^>]*>(.*?)<div[^>]*id="note-2"/s);
    
    if (!note1Section) {
      console.log("Could not find note-1 section");
      return result;
    }
    
    const note1Content = note1Section[1];
    
    // Extract all semester panels using IDs (collapse0, collapse1, etc.)
    const examPanelPattern = /<div[^>]*id="collapse(\d+)"[^>]*>(.*?)<\/div>\s*<\/div>/gs;
    let panelMatch;
    const examPanelRegex = new RegExp(examPanelPattern);
    let i = 0;
    
    while ((panelMatch = examPanelRegex.exec(note1Content)) !== null) {
      const semesterIndex = parseInt(panelMatch[1], 10);
      const panelContent = panelMatch[2];
      
      // Extract exam rows from the panel content
      const examRowPattern = /<tr>\s*<td>\s*<p>\(([^)]+)\)\s*([^<]+)<\/p>\s*<\/td>\s*<td>\s*<p>([^<]+)<\/p>\s*<\/td>\s*<\/tr>/g;
      let rowMatch;
      
      while ((rowMatch = examRowPattern.exec(panelContent)) !== null) {
        const type = rowMatch[1].trim();
        const name = rowMatch[2].trim();
        const grade = rowMatch[3].trim();
        
        // Skip placeholder grades
        if (grade === '---') continue;
        
        result.push({
          name,
          type,
          grade,
          semester: semesterIndex + 1  // Convert from 0-based to 1-based indexing
        });
      }
      
      // Alternative pattern in case the first one doesn't match
      if (result.length === 0) {
        const altPattern = /<tr>\s*<td>\s*<p>([^<]+)<\/p>\s*<\/td>\s*<td>\s*<p>([^<]+)<\/p>\s*<\/td>\s*<\/tr>/g;
        while ((rowMatch = altPattern.exec(panelContent)) !== null) {
          const fullName = rowMatch[1].trim();
          const grade = rowMatch[2].trim();
          
          // Skip placeholder grades or header rows
          if (grade === '---' || fullName === 'Denumirea Obiectelor') continue;
          
          // Try to extract the type from the name
          const typeMatch = fullName.match(/^\(([^)]+)\)/);
          const type = typeMatch ? typeMatch[1] : 'Unknown';
          const name = typeMatch ? fullName.substring(typeMatch[0].length).trim() : fullName;
          
          result.push({
            name,
            type,
            grade,
            semester: semesterIndex + 1
          });
        }
      }
      
      // Safety break
      if (i++ > 10) break;
    }
    
    return result;
  } catch (error) {
    console.error("Error parsing exams:", error);
    return result;
  }
};

/**
 * Parse annual grades from the HTML response using regex
 * @param html The HTML response from the API
 * @returns Array of annual grade objects
 */
const parseAnnualGrades = (html: string): AnnualGrade[] => {
  const result: AnnualGrade[] = [];
  
  // Extract annual grades panels
  const annualPanelPattern = /<div[^>]*class=["'][^"']*panel-collapse[^"']*["'][^>]*id=["']collaps2e(\d+)["'][^>]*>(.*?)<\/div>\s*<\/div>\s*<\/div>/gs;
  const annualPanels = extractAllMatches(html, annualPanelPattern);
  
  annualPanels.forEach((panelMatch) => {
    const annualContent = panelMatch[2];
    
    // Extract grade rows (skip the header row)
    const gradeRowPattern = /<tr[^>]*>\s*<td[^>]*>\s*<p[^>]*>(.*?)<\/p>\s*<\/td>\s*<td[^>]*>\s*<p[^>]*>(.*?)<\/p>\s*<\/td>\s*<td[^>]*>\s*<p[^>]*>(.*?)<\/p>\s*<\/td>\s*<td[^>]*>\s*<p[^>]*>(.*?)<\/p>\s*<\/td>\s*<td[^>]*>\s*<p[^>]*>(.*?)<\/p>\s*<\/td>\s*<td[^>]*>\s*<p[^>]*>(.*?)<\/p>\s*<\/td>\s*<\/tr>/gs;
    const gradeRows = extractAllMatches(annualContent, gradeRowPattern);
    
    gradeRows.forEach(row => {
      const subject = row[1].trim();
      const semester1Grade = row[2].trim();
      const semester2Grade = row[3].trim();
      const annualGrade = row[4].trim();
      const evaluationGrade = row[5].trim();
      const evaluationType = row[6].trim();
      
      result.push({
        subject,
        semester1Grade: semester1Grade || undefined,
        semester2Grade: semester2Grade || undefined,
        annualGrade: annualGrade || undefined,
        evaluationGrade: evaluationGrade || undefined,
        evaluationType: evaluationType || undefined
      });
    });
  });
  
  return result;
};

/**
 * Determine which semester is currently active based on the HTML using regex
 * @param html The HTML response from the API
 * @returns The active semester number or undefined
 */
const determineCurrentSemester = (html: string): number | undefined => {
  // Look for an expanded panel in the situatia-curenta section
  const expandedPanelPattern = /<div[^>]*class=["'][^"']*panel-collapse\s+in[^"']*["'][^>]*id=["']collaps3e(\d+)["'][^>]*>/;
  const match = html.match(expandedPanelPattern);
  
  if (match) {
    return parseInt(match[1]) + 1; // +1 because they're 0-indexed
  }
  
  return undefined;
};

/**
 * Parse all student grades data from the HTML response using regex
 * @param html The HTML response from the API
 * @returns Complete student grades information
 */
export const parseStudentGradesData = (html: string): StudentGrades => {
  try {
    console.log("Starting to parse student data");
    
    // Check if we have HTML content
    if (!html || html.trim() === '') {
      console.error("HTML is empty");
      throw new Error("Empty HTML content");
    }
    
    // Extract all data using our parsing functions
    const studentInfo = parseStudentInfo(html);
    console.log("Parsed student info:", studentInfo);
    
    // First parse exams since we need them to calculate accurate semester averages
    const exams = parseExams(html);
    console.log("Parsed exams, count:", exams.length);
    
    // Then parse current grades and apply exam weights to averages
    const currentGrades = parseCurrentGrades(html);
    console.log("Parsed current grades, count:", currentGrades.length);
    
    // Apply exam/thesis grades to the semester averages
    applyExamGradesToAverages(currentGrades, exams);
    
    const annualGrades = parseAnnualGrades(html);
    console.log("Parsed annual grades, count:", annualGrades.length);
    
    const currentSemester = determineCurrentSemester(html);
    console.log("Current semester:", currentSemester);
    
    return {
      studentInfo,
      currentGrades,
      exams,
      annualGrades,
      currentSemester
    };
  } catch (error) {
    console.error("Error parsing HTML:", error);
    
    // Return mock data if parsing fails
    return createMockData();
  }
};

/**
 * Apply exam and thesis grades to recalculate subject averages in each semester
 * @param semesters Array of semester data
 * @param exams Array of exam data
 */
const applyExamGradesToAverages = (semesters: SemesterGrades[], exams: Exam[]): void => {
  // Process each semester
  semesters.forEach(semester => {
    // Get exams for this specific semester
    const semesterExams = exams.filter(exam => exam.semester === semester.semester);
    
    // Process each subject in the semester
    semester.subjects.forEach(subject => {
      // Find matching exam for this subject in this semester
      const matchingExam = semesterExams.find(exam => {
        // Check if the exam name contains the subject name or vice versa
        return exam.name.toLowerCase().includes(subject.name.toLowerCase()) || 
               subject.name.toLowerCase().includes(exam.name.toLowerCase());
      });
      
      // If we found a matching exam and the subject has an average
      if (matchingExam && subject.average !== undefined) {
        const examGrade = parseGrade(matchingExam.grade);
        
        if (!isNaN(examGrade)) {
          let newAverage: number;
          
          // Apply different calculation based on exam type
          if (matchingExam.type.toLowerCase() === 'teza') {
            // For "Teza": (average + examGrade) / 2
            newAverage = (subject.average + examGrade) / 2;
          } else if (matchingExam.type.toLowerCase() === 'examen') {
            // For "Examen": average * 0.6 + examGrade * 0.4
            newAverage = subject.average * 0.6 + examGrade * 0.4;
          } else {
            // For other types, don't modify the average
            return;
          }
          
          // Round DOWN to 2 decimal places
          subject.average = Math.floor(newAverage * 100) / 100;
          subject.displayedAverage = subject.average.toFixed(2);
          
          console.log(`Applied ${matchingExam.type} grade ${examGrade} to ${subject.name}, new average: ${subject.average}`);
        }
      }
    });
  });
};