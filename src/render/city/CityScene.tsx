import { useMemo } from 'react';
import { cityProfile, type CityProfile } from '../../city/profiles';
import { PALETTES, type Palette } from '../../city/scenery';
import { useAtlasStore } from '../../store/useAtlasStore';
import { CitySites } from './CitySites';
import { CityLife } from './CityLife';
import { cityClock, CityClock } from './ColoredInstances';
import { PortKit, RailLine } from './PortKit';
import { AirportKit } from './AirportKit';
import {
  ElevatedHighway,
  FarCity,
  IndustrialKit,
  ParkingAndFuel,
  RoadDetails,
} from './DistrictKit';

export { cityClock };
export function useCityProfile(): { profile: CityProfile; palette: Palette } {
  const id = useAtlasStore((s) => s.warehouseId);
  return useMemo(() => {
    const profile = cityProfile(id);
    return { profile, palette: PALETTES[profile.theme] };
  }, [id]);
}
/** Ciudad viva alrededor del hub (vista región): polígono de terceros, red viaria y paisaje urbano temático. */
export function CityScene() {
  const { profile, palette } = useCityProfile();
  const { theme, hubId } = profile;
  const port = theme === 'port' || theme === 'tower-port';
  return (
    <group>
      <CityClock />
      <CitySites sites={profile.sites} />
      <CityLife key={hubId} sites={profile.sites} />
      <RailLine />
      <RoadDetails />
      <ParkingAndFuel hubId={hubId} />
      {port && <PortKit tower={theme === 'tower-port'} water={palette.water} seed={hubId} />}
      {theme === 'industrial' && <IndustrialKit seed={hubId} />}
      {theme === 'airport' && <AirportKit />}
      {theme === 'highway-hills' && <ElevatedHighway />}
      <FarCity theme={theme} hubId={hubId} />
    </group>
  );
}
