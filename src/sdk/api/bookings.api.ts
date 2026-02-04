import type {
    Booking,
    BookingsListResponse,
    CreateBookingRequest,
    CreateBookingResponse,
    GetUserBookingsParams,
} from '../types/index.js';
import { getVersionedEndpoint } from '../utils/api-paths.js';
import { handleDeskbirdException } from '../utils/error-handler.js';
import type { HttpClient } from '../utils/http-client.js';

/**
 * Bookings API client for managing desk bookings
 */
export class BookingsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }

  /**
   * Create a new booking
   */
  async createBooking(bookingRequest: CreateBookingRequest): Promise<CreateBookingResponse> {
    
    try {
      const response = await this.client.post<CreateBookingResponse>(
        getVersionedEndpoint('BOOKINGS_CREATE', '/bookings'), 
        bookingRequest
      );
      
      if (!response.success || !response.data) {
        throw new Error(`Failed to create booking: ${response.status} ${response.statusText}`);
      }
      
      return response.data;
    } catch (error: unknown) {
      handleDeskbirdException(error, 'createBooking');
    }
  }

  /**
   * Get user's bookings with filtering options
   */
  async getUserBookings(params: GetUserBookingsParams = {}): Promise<BookingsListResponse> {
    
    try {
      // Set defaults
      const queryParams = {
        skip: params.skip?.toString() || '0',
        limit: params.limit?.toString() || '10',
        includeInstances: params.include_instances?.toString() || 'true',
        upcoming: params.upcoming?.toString() || 'true',
      };

      // Build URL with query parameters
      const baseEndpoint = getVersionedEndpoint('USER_BOOKINGS', '/user/bookings');
      const queryString = new URLSearchParams(queryParams).toString();
      const fullPath = `${baseEndpoint}?${queryString}`;

      const response = await this.client.get<BookingsListResponse>(fullPath);
      
      if (!response.success || !response.data) {
        throw new Error(`Failed to get user bookings: ${response.status} ${response.statusText}`);
      }
      
      return response.data;
    } catch (error: unknown) {
      handleDeskbirdException(error, 'getUserBookings');
    }
  }

  /**
   * Cancel a booking by ID
   */
  async cancelBooking(bookingId: string): Promise<void> {
    
    try {
      const response = await this.client.delete(
        getVersionedEndpoint('BOOKINGS_DELETE', `/bookings/${bookingId}`)
      );
      
      if (!response.success) {
        throw new Error(`Failed to cancel booking: ${response.status} ${response.statusText}`);
      }
    } catch (error: unknown) {
      handleDeskbirdException(error, 'cancelBooking');
    }
  }

  /**
   * Get booking details by ID
   */
  async getBooking(bookingId: string): Promise<Booking> {
    
    try {
      const response = await this.client.get<{ booking: Booking }>(
        getVersionedEndpoint('BOOKINGS_GET', `/bookings/${bookingId}`)
      );
      
      if (!response.success || !response.data) {
        throw new Error(`Failed to get booking: ${response.status} ${response.statusText}`);
      }
      
      return response.data.booking;
    } catch (error: unknown) {
      handleDeskbirdException(error, 'getBooking');
    }
  }

  /**
   * Get upcoming bookings for the user
   */
  async getUpcomingBookings(limit: number = 10): Promise<Booking[]> {
    
    try {
      const bookingsResponse = await this.getUserBookings({
        limit,
        upcoming: true,
        include_instances: true,
      });
      
      return bookingsResponse.results || [];
    } catch (error: unknown) {
      handleDeskbirdException(error, 'getUpcomingBookings');
    }
  }
}
