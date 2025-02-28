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