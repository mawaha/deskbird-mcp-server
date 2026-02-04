import type { FavoriteResourceResponse, UnfavoriteResourceResponse } from '../types/index.js';
import { getVersionedEndpoint } from '../utils/api-paths.js';
import { handleDeskbirdException } from '../utils/error-handler.js';
import type { HttpClient } from '../utils/http-client.js';

/**
 * Favorites API client for managing favorite desks
 */
export class FavoritesApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }

  /**
   * Add a desk to favorites by zone ID
   */
  async addFavorite(zoneId: number): Promise<FavoriteResourceResponse> {
    
    try {
      const response = await this.client.patch<FavoriteResourceResponse>(
        getVersionedEndpoint('FAVORITES_ADD', '/user/favoriteResource'),
        { id: zoneId }
      );
      
      if (!response.success || !response.data) {
        throw new Error(`Failed to add favorite: ${response.status} ${response.statusText}`);
      }
      
      return response.data;
    } catch (error: unknown) {
      handleDeskbirdException(error, 'addFavorite');
    }
  }

  /**
   * Remove a desk from favorites by zone ID
   */
  async removeFavorite(zoneId: number): Promise<UnfavoriteResourceResponse> {
    
    try {
      const response = await this.client.delete<UnfavoriteResourceResponse>(
        getVersionedEndpoint('FAVORITES_REMOVE', `/user/favoriteResource/${zoneId}`)
      );
      
      if (!response.success || !response.data) {
        throw new Error(`Failed to remove favorite: ${response.status} ${response.statusText}`);
      }
      
      return response.data;
    } catch (error: unknown) {
      handleDeskbirdException(error, 'removeFavorite');
    }
  }

  /**
   * Toggle favorite status for a desk
   */
  async toggleFavorite(zoneId: number, isFavorite: boolean): Promise<FavoriteResourceResponse | UnfavoriteResourceResponse> {
    
    if (isFavorite) {
      return this.addFavorite(zoneId);
    } else {
      return this.removeFavorite(zoneId);
    }
  }
}
