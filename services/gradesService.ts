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
export const loginWithIdnp = async (idnp: string, signal?: AbortSignal): Promise<any> => {
  try {
    const response = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `idnp=${idnp}`,
      signal,
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
export const fetchStudentInfo = async (idnp: string, signal?: AbortSignal): Promise<string> => {
  try {
    // First login with the IDNP
    await loginWithIdnp(idnp, signal);
    
    // Then fetch the student info
    const infoResponse = await fetch(`${INFO_URL}${idnp}`, {
      method: 'GET',
      signal,
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
  yearNumber?: number; // Numeric year from roman numerals (I=1, II=2, III=3, IV=4)
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
  isUpcoming?: boolean;
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
 * Convert roman numeral to arabic number
 * @param roman Roman numeral string (I, II, III, IV)
 * @returns The numeric value or undefined if invalid
 */
const romanToArabic = (roman: string): number | undefined => {
  const romanMap: { [key: string]: number } = {
    'I': 1,
    'II': 2,
    'III': 3,
    'IV': 4,
    'V': 5,
    'VI': 6,
    'VII': 7,
    'VIII': 8
  };
  
  const trimmed = roman.trim().toUpperCase();
  return romanMap[trimmed];
};

/**
 * Parse student personal information from the HTML response using regex
 * @param html The HTML response from the API
 * @returns Student info object
 */
const parseStudentInfo = (html: string): StudentInfo => {
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
    
    // Extract and convert roman numeral year
    const studyYearStr = studyYearMatch ? studyYearMatch[1].trim() : "";
    const yearNumber = studyYearStr ? romanToArabic(studyYearStr) : undefined;
    
    return {
      name: nameMatch ? nameMatch[1].trim() : "Unknown",
      firstName: firstNameMatch ? firstNameMatch[1].trim() : "Student",
      patronymic: patronymicMatch ? patronymicMatch[1].trim() : "",
      studyYear: studyYearStr,
      yearNumber: yearNumber,
      group: groupMatch ? groupMatch[1].trim() : "",
      specialization: specMatch ? specMatch[1].trim() : "",
      curator: curatorMatch ? curatorMatch[1].trim() : undefined,
      departmentHead: deptHeadMatch ? deptHeadMatch[1].trim() : undefined,
      status: statusMatch ? statusMatch[1].trim() : undefined
    };
  } catch (error) {
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
    const situatiaCurentaPattern = /<div[^>]*id="situatia-curenta"[^>]*>([\s\S]*?)<div[^>]*id="note-1"/;
    const situatiaCurentaMatch = html.match(situatiaCurentaPattern);
    
    if (!situatiaCurentaMatch) {
      return createFallbackSemesters();
    }
    
    const situatiaCurentaContent = situatiaCurentaMatch[1];
    const semesterPanels = [];
    
    // Updated pattern to better handle nested content
    const semesterPattern = /<div[^>]*class="panel-heading"[^>]*>[\s\S]*?<h4[^>]*>[\s\S]*?<a[^>]*>[\s\S]*?Semestrul\s+([IVX]+|[0-9]+)[\s\S]*?<\/a>[\s\S]*?<\/h4>[\s\S]*?<\/div>[\s\S]*?<div[^>]*id="collaps3e(\d+)"[^>]*>([\s\S]*?)(?=<div[^>]*class="panel-heading"|<div[^>]*id="note-1"|$)/g;
    let panelMatch;
    let lastIndex = 0;
    
    while ((panelMatch = semesterPattern.exec(situatiaCurentaContent)) !== null) {
      const semesterText = panelMatch[1].trim();
      const panelId = panelMatch[2];
      const fullContent = panelMatch[3];
      lastIndex = panelMatch.index + panelMatch[0].length;
      
      // Convert Roman numerals or digits to semester number
      let semesterNumber: number;
      if (semesterText === 'I') {
        semesterNumber = 1;
      } else if (semesterText === 'II') {
        semesterNumber = 2;
      } else if (/^\d+$/.test(semesterText)) {
        semesterNumber = parseInt(semesterText, 10);
      } else {
        semesterNumber = semesterPanels.length + 1;
      }
      
      // Find all tables in this panel's content
      const tables = fullContent.match(/<table[^>]*class="table[^>]*>[\s\S]*?<\/table>/g) || [];
      
      if (tables.length > 0) {
        semesterPanels.push({
          semesterNumber,
          semesterText,
          panelId,
          tableContent: tables.join('\n'),
          fullPanelContent: fullContent
        });
      }
    }
    
    // Process each semester panel
    semesterPanels.forEach((panel) => {
      const { semesterNumber, tableContent, fullPanelContent } = panel;
      
      const semester: SemesterGrades = {
        semester: semesterNumber,
        subjects: []
      };
      
      parseSubjectsFromTable(tableContent, semester);
      parseAbsencesFromPanel(fullPanelContent, semester);
      
      if (semester.subjects.length > 0 || semester.absences) {
        result.push(semester);
      }
    });
    
    if (result.length === 0) {
      return createFallbackSemesters();
    }
    
    ensureBothSemestersExist(result);
    result.sort((a, b) => a.semester - b.semester);
    
    return result;
  } catch (error) {
    return createFallbackSemesters();
  }
};

/**
 * Helper function to parse subjects from a table content string
 * @param tableContent The HTML content of the table within a semester panel
 * @param semester The semester object to populate
 */
const parseSubjectsFromTable = (tableContent: string, semester: SemesterGrades): void => {
  // Extract rows from the table, skipping the header row
  let rowPattern = /<tr>\s*<td>\s*<p>(.*?)<\/p>\s*<\/td>\s*<td>\s*<p>(.*?)<\/p>\s*<\/td>\s*<\/tr>/gs;
  let rowMatch;
  let found = false;
  
  // Track subject names to avoid duplicates
  const subjectNames = new Set<string>();
  
  // Process each row in the table
  while ((rowMatch = rowPattern.exec(tableContent)) !== null) {
    // Extract subject name and grades, removing any HTML tags
    const subjectName = rowMatch[1].replace(/<[^>]*>/g, '').trim();
    const gradesText = rowMatch[2].replace(/<[^>]*>/g, '').trim();
    
    // Skip header rows, absence rows, and rows that don't contain actual subjects
    if (
      subjectName === "Denumire" || 
      subjectName === "Note" || 
      subjectName === "Denumirea Obiectelor" ||
      subjectName === "Semestrul I" ||
      subjectName === "Semestrul II" ||
      subjectName.toLowerCase().includes("absențe") ||
      subjectNames.has(subjectName)
    ) {
      continue;
    }
    
    // Add this subject name to the set
    subjectNames.add(subjectName);
    found = true;
    
    // Parse grades by splitting the grades text
    const grades = gradesText
      ? gradesText
          .split(/[,\s]+/)
          .map(g => g.trim())
          .filter(g => g.length > 0 && /^\d+([.,]\d+)?$/.test(g))
      : [];
    
    // Calculate average grade
    const average = calculateAverage(grades);
    
    // Add subject to the semester
    semester.subjects.push({
      name: subjectName,
      grades,
      average,
      displayedAverage: average ? average.toFixed(2) : '-'
    });
  }
  
  // If no subjects found with <p> tags, try the alternative pattern
  if (!found) {
    // Alternative pattern that doesn't require <p> tags
    rowPattern = /<tr>\s*<td[^>]*>\s*(.*?)\s*<\/td>\s*<td[^>]*>\s*(.*?)\s*<\/td>\s*<\/tr>/gs;
    
    while ((rowMatch = rowPattern.exec(tableContent)) !== null) {
      const subjectName = rowMatch[1].replace(/<[^>]*>/g, '').trim();
      const gradesText = rowMatch[2].replace(/<[^>]*>/g, '').trim();
      
      // Skip header rows, absence rows, and already included subjects
      if (
        subjectName === "Denumire" || 
        subjectName === "Note" || 
        subjectName === "Denumirea Obiectelor" ||
        subjectName === "Semestrul I" ||
        subjectName === "Semestrul II" ||
        subjectName.toLowerCase().includes("absențe") ||
        subjectNames.has(subjectName)
      ) {
        continue;
      }
      
      // Add this subject name to the set
      subjectNames.add(subjectName);
      
      // Parse grades
      const grades = gradesText
        ? gradesText
            .split(/[,\s]+/)
            .map(g => g.trim())
            .filter(g => g.length > 0 && /^\d+([.,]\d+)?$/.test(g))
        : [];
      
      // Calculate average grade
      const average = calculateAverage(grades);
      
      // Add subject to the semester
      semester.subjects.push({
        name: subjectName,
        grades,
        average,
        displayedAverage: average ? average.toFixed(2) : '-'
      });
    }
  }
}

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
  const result: SemesterGrades[] = [];
  
  // Try to find any semestral data by direct content search
  const semester1Pattern = /Semestrul\s+I|Semestrul\s+1/i;
  const semester2Pattern = /Semestrul\s+II|Semestrul\s+2/i;
  
  const hasSemester1 = semester1Pattern.test(situatiaCurentaContent);
  const hasSemester2 = semester2Pattern.test(situatiaCurentaContent);
  
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
        
        // Identify if this is an upcoming exam (grade is TBD, empty, or specific format)
        const isUpcoming = grade === '---' || grade === '' || grade === 'TBD' || 
                           grade.toLowerCase().includes('pending');
        
        // Skip completely empty grades (if needed - keeping them for now to show upcoming exams)
        // if (grade === '---') continue;
        
        result.push({
          name,
          type,
          grade: isUpcoming ? 'TBD' : grade,
          semester: semesterIndex + 1,  // Convert from 0-based to 1-based indexing
          isUpcoming
        });
      }
      
      // Alternative pattern in case the first one doesn't match
      if (result.length === 0) {
        const altPattern = /<tr>\s*<td>\s*<p>([^<]+)<\/p>\s*<\/td>\s*<td>\s*<p>([^<]+)<\/p>\s*<\/td>\s*<\/tr>/g;
        while ((rowMatch = altPattern.exec(panelContent)) !== null) {
          const fullName = rowMatch[1].trim();
          const grade = rowMatch[2].trim();
          
          // Skip header rows
          if (fullName === 'Denumirea Obiectelor') continue;
          
          // Identify if this is an upcoming exam
          const isUpcoming = grade === '---' || grade === '' || grade === 'TBD' || 
                             grade.toLowerCase().includes('pending');
          
          // Try to extract the type from the name
          const typeMatch = fullName.match(/^\(([^)]+)\)/);
          const type = typeMatch ? typeMatch[1] : 'Unknown';
          const name = typeMatch ? fullName.substring(typeMatch[0].length).trim() : fullName;
          
          result.push({
            name,
            type,
            grade: isUpcoming ? 'TBD' : grade,
            semester: semesterIndex + 1,
            isUpcoming
          });
        }
      }
      
      // Safety break
      if (i++ > 10) break;
    }
    
    return result;
  } catch (error) {
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
    if (!html || html.trim() === '') {
      throw new Error("Empty HTML content");
    }
    
    const studentInfo = parseStudentInfo(html);
    const exams = parseExams(html);
    const currentGrades = parseCurrentGrades(html);
    applyExamGradesToAverages(currentGrades, exams, studentInfo);
    const annualGrades = parseAnnualGrades(html);
    const currentSemester = determineCurrentSemester(html);
    
    return {
      studentInfo,
      currentGrades,
      exams,
      annualGrades,
      currentSemester
    };
  } catch (error) {
    return createMockData();
  }
};

/**
 * Apply exam and thesis grades to recalculate subject averages in each semester
 * Only applies grades from the current academic year to avoid contaminating averages with past year exams
 * @param semesters Array of semester data
 * @param exams Array of exam data
 * @param studentInfo Student information containing yearNumber
 */
const applyExamGradesToAverages = (semesters: SemesterGrades[], exams: Exam[], studentInfo: StudentInfo): void => {
  // Determine the current year's semester range
  const currentYear = studentInfo.yearNumber || 1; // Default to year 1 if not available
  const currentYearFirstSemester = (currentYear - 1) * 2 + 1;
  const currentYearLastSemester = currentYear * 2;
  
  // Filter exams to only include current year's exams
  const currentYearExams = exams.filter(exam => 
    exam.semester >= currentYearFirstSemester && exam.semester <= currentYearLastSemester
  );
  
  // Process each semester
  semesters.forEach(semester => {
    // Skip if this semester is not in the current year
    if (semester.semester < currentYearFirstSemester || semester.semester > currentYearLastSemester) {
      return;
    }
    
    // Get exams for this specific semester
    const semesterExams = currentYearExams.filter(exam => exam.semester === semester.semester);
    
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
        }
      }
    });
  });
};

/**
 * Ensures both semester I and semester II exist in the results
 * If one is missing, adds an empty semester for it
 * @param result Array of semester grades objects
 */
const ensureBothSemestersExist = (result: SemesterGrades[]): void => {
  // Check if semester 1 exists
  const hasSemester1 = result.some(s => s.semester === 1);
  // Check if semester 2 exists
  const hasSemester2 = result.some(s => s.semester === 2);

  // Add semester 1 if missing
  if (!hasSemester1) {
    result.push({
      semester: 1,
      subjects: [{
        name: "No subjects available for Semester I",
        grades: [],
        displayedAverage: "-"
      }]
    });
  }

  // Add semester 2 if missing
  if (!hasSemester2) {
    result.push({
      semester: 2,
      subjects: [{
        name: "No subjects available for Semester II",
        grades: [],
        displayedAverage: "-"
      }]
    });
  }
};

// --- Caching & Silent Refresh Layer ---
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';

const IDNP_KEY = '@planner_idnp';

const GRADES_CACHE_KEY_PREFIX = '@grades_cache_html_';
const GRADES_CACHE_TIME_KEY_PREFIX = '@grades_cache_time_';
const GRADES_UPDATED_EVENT = 'grades_updated_event';
export const GRADES_REFRESH_START_EVENT = 'grades_refresh_start_event';
export const GRADES_REFRESH_END_EVENT = 'grades_refresh_end_event';

// Toggle for console logging (can be flipped to false for production noise reduction)
const GRADES_DEBUG_LOGS = true;

type GradesListener = () => void;
const gradeListeners = new Set<GradesListener>();
// Track in-flight refresh promises per IDNP to avoid duplicate network requests
const inflightRefresh: Record<string, Promise<void>> = {};
const inflightControllers: Record<string, AbortController> = {};

export const gradesDataService = {
  subscribe(listener: GradesListener) {
    gradeListeners.add(listener);
    return () => gradeListeners.delete(listener);
  },
  notify() {
    gradeListeners.forEach(l => l());
    DeviceEventEmitter.emit(GRADES_UPDATED_EVENT);
  },
  cancelRefresh(idnp?: string) {
    if (idnp) {
      inflightControllers[idnp]?.abort();
    } else {
      Object.values(inflightControllers).forEach(controller => controller.abort());
    }
  },
  async clearCache(idnp: string) {
    await Promise.all([
      AsyncStorage.removeItem(GRADES_CACHE_KEY_PREFIX + idnp),
      AsyncStorage.removeItem(GRADES_CACHE_TIME_KEY_PREFIX + idnp)
    ]);
    this.notify();
  },
  isRefreshing(idnp: string) {
    return !!inflightRefresh[idnp];
  },
  async getCached(idnp: string) {
    const [html, ts] = await Promise.all([
      AsyncStorage.getItem(GRADES_CACHE_KEY_PREFIX + idnp),
      AsyncStorage.getItem(GRADES_CACHE_TIME_KEY_PREFIX + idnp)
    ]);
    return html ? { html, timestamp: ts ? parseInt(ts,10) : null } : null;
  },
  async store(idnp: string, html: string) {
    const currentIdnp = await AsyncStorage.getItem(IDNP_KEY);
    if (currentIdnp !== idnp) {
      if (GRADES_DEBUG_LOGS) console.log('[grades] store skipped - IDNP mismatch');
      return null;
    }
    const ts = Date.now();
    await Promise.all([
      AsyncStorage.setItem(GRADES_CACHE_KEY_PREFIX + idnp, html),
      AsyncStorage.setItem(GRADES_CACHE_TIME_KEY_PREFIX + idnp, ts.toString())
    ]);
    this.notify();
    return ts;
  },
  async silentRefresh(idnp: string): Promise<{ updated: boolean; html: string | null; timestamp: number | null }> {
    const startTime = Date.now();
    const cached = await this.getCached(idnp);
    if (GRADES_DEBUG_LOGS) console.log('[grades] silentRefresh start', { idnp, hasCached: !!cached });
    DeviceEventEmitter.emit(GRADES_REFRESH_START_EVENT, { idnp, cachedTimestamp: cached?.timestamp || null });

    // If a refresh is already in progress for this IDNP, don't start another
    if (!inflightRefresh[idnp]) {
      inflightRefresh[idnp] = (async () => {
        const controller = new AbortController();
        inflightControllers[idnp]?.abort();
        inflightControllers[idnp] = controller;
        try {
          const freshHtml = await fetchStudentInfo(idnp, controller.signal);
          const currentIdnp = await AsyncStorage.getItem(IDNP_KEY);
          if (controller.signal.aborted || currentIdnp !== idnp) {
            if (GRADES_DEBUG_LOGS) console.log('[grades] refresh aborted or IDNP changed, skipping store');
            await Promise.all([
              AsyncStorage.removeItem(GRADES_CACHE_KEY_PREFIX + idnp),
              AsyncStorage.removeItem(GRADES_CACHE_TIME_KEY_PREFIX + idnp)
            ]);
            DeviceEventEmitter.emit(GRADES_REFRESH_END_EVENT, { idnp, updated: false, aborted: true, duration: Date.now() - startTime });
          } else if (freshHtml && freshHtml.trim()) {
            if (GRADES_DEBUG_LOGS) console.log('[grades] fetched fresh HTML, storing');
            await this.store(idnp, freshHtml);
            if (GRADES_DEBUG_LOGS) console.log('[grades] store complete');
            DeviceEventEmitter.emit(GRADES_REFRESH_END_EVENT, { idnp, updated: true, duration: Date.now() - startTime });
          } else {
            if (GRADES_DEBUG_LOGS) console.log('[grades] fresh HTML empty, keeping cache');
            DeviceEventEmitter.emit(GRADES_REFRESH_END_EVENT, { idnp, updated: false, duration: Date.now() - startTime });
          }
        } catch (err) {
          if (controller.signal.aborted) {
            if (GRADES_DEBUG_LOGS) console.log('[grades] silentRefresh aborted');
            DeviceEventEmitter.emit(GRADES_REFRESH_END_EVENT, { idnp, updated: false, aborted: true, duration: Date.now() - startTime });
          } else {
            if (GRADES_DEBUG_LOGS) console.log('[grades] silentRefresh error', err);
            DeviceEventEmitter.emit(GRADES_REFRESH_END_EVENT, { idnp, updated: false, error: true, duration: Date.now() - startTime });
          }
        } finally {
          if (inflightControllers[idnp] === controller) {
            delete inflightControllers[idnp];
          }
          delete inflightRefresh[idnp];
        }
      })();
    } else if (GRADES_DEBUG_LOGS) {
      // silentRefresh deduped (in-flight)
    }

    return { updated: false, html: cached?.html || null, timestamp: cached?.timestamp || null };
  }
};