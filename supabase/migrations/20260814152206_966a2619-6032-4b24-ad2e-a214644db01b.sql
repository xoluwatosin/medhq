CREATE TABLE IF NOT EXISTS public.mu_lga_index (
  state text NOT NULL,
  lga text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (state, lga)
);
GRANT SELECT ON public.mu_lga_index TO authenticated;
GRANT ALL ON public.mu_lga_index TO service_role;
ALTER TABLE public.mu_lga_index ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Signed in users can read the LGA index" ON public.mu_lga_index;
CREATE POLICY "Signed in users can read the LGA index" ON public.mu_lga_index FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.mu_loc_key(_v text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT regexp_replace(
           regexp_replace(lower(coalesce(_v,'')),
             '\s*(local government( area)?|l\.?g\.?a\.?|state)\s*$', '', 'g'),
           '[^a-z0-9]', '', 'g');
$$;

INSERT INTO public.mu_lga_index (state, lga)
SELECT s.state, btrim(l)
FROM (VALUES
('Abia','Aba North|Aba South|Arochukwu|Bende|Ikwuano|Isiala Ngwa North|Isiala Ngwa South|Isuikwuato|Obi Ngwa|Ohafia|Osisioma|Ugwunagbo|Ukwa East|Ukwa West|Umuahia North|Umuahia South|Umu Nneochi'),
('Adamawa','Demsa|Fufure|Ganye|Gayuk|Gombi|Grie|Hong|Jada|Lamurde|Madagali|Maiha|Mayo-Belwa|Michika|Mubi North|Mubi South|Numan|Shelleng|Song|Toungo|Yola North|Yola South'),
('Akwa Ibom','Abak|Eastern Obolo|Eket|Esit-Eket|Essien Udim|Etim-Ekpo|Etinan|Ibeno|Ibesikpo-Asutan|Ibiono-Ibom|Ika|Ikono|Ikot Abasi|Ikot Ekpene|Ini|Itu|Mbo|Mkpat-Enin|Nsit-Atai|Nsit-Ibom|Nsit-Ubium|Obot-Akara|Okobo|Onna|Oron|Oruk Anam|Udung-Uko|Ukanafun|Uruan|Urue-Offong/Oruko|Uyo'),
('Anambra','Aguata|Anambra East|Anambra West|Anaocha|Awka North|Awka South|Ayamelum|Dunukofia|Ekwusigo|Idemili North|Idemili South|Ihiala|Njikoka|Nnewi North|Nnewi South|Ogbaru|Onitsha North|Onitsha South|Orumba North|Orumba South|Oyi'),
('Bauchi','Alkaleri|Bauchi|Bogoro|Damban|Darazo|Dass|Gamawa|Ganjuwa|Giade|Itas/Gadau|Jama''are|Katagum|Kirfi|Misau|Ningi|Shira|Tafawa Balewa|Toro|Warji|Zaki'),
('Bayelsa','Brass|Ekeremor|Kolokuma/Opokuma|Nembe|Ogbia|Sagbama|Southern Ijaw|Yenagoa'),
('Benue','Ado|Agatu|Apa|Buruku|Gboko|Guma|Gwer East|Gwer West|Katsina-Ala|Konshisha|Kwande|Logo|Makurdi|Obi|Ogbadibo|Ohimini|Oju|Okpokwu|Otukpo|Tarka|Ukum|Ushongo|Vandeikya'),
('Borno','Abadam|Askira/Uba|Bama|Bayo|Biu|Chibok|Damboa|Dikwa|Gubio|Guzamala|Gwoza|Hawul|Jere|Kaga|Kala/Balge|Konduga|Kukawa|Kwaya Kusar|Mafa|Magumeri|Maiduguri|Marte|Mobbar|Monguno|Ngala|Nganzai|Shani'),
('Cross River','Abi|Akamkpa|Akpabuyo|Bakassi|Bekwarra|Biase|Boki|Calabar Municipal|Calabar South|Etung|Ikom|Obanliku|Obubra|Obudu|Odukpani|Ogoja|Yakuur|Yala'),
('Delta','Aniocha North|Aniocha South|Bomadi|Burutu|Ethiope East|Ethiope West|Ika North East|Ika South|Isoko North|Isoko South|Ndokwa East|Ndokwa West|Okpe|Oshimili North|Oshimili South|Patani|Sapele|Udu|Ughelli North|Ughelli South|Ukwuani|Uvwie|Warri North|Warri South|Warri South West'),
('Ebonyi','Abakaliki|Afikpo North|Afikpo South|Ebonyi|Ezza North|Ezza South|Ikwo|Ishielu|Ivo|Izzi|Ohaozara|Ohaukwu|Onicha'),
('Edo','Akoko-Edo|Egor|Esan Central|Esan North-East|Esan South-East|Esan West|Etsako Central|Etsako East|Etsako West|Igueben|Ikpoba-Okha|Oredo|Orhionmwon|Ovia North-East|Ovia South-West|Owan East|Owan West|Uhunmwonde'),
('Ekiti','Ado-Ekiti|Efon|Ekiti East|Ekiti South-West|Ekiti West|Emure|Gbonyin|Ido-Osi|Ijero|Ikere|Ikole|Ilejemeje|Irepodun/Ifelodun|Ise/Orun|Moba|Oye'),
('Enugu','Aninri|Awgu|Enugu East|Enugu North|Enugu South|Ezeagu|Igbo-Etiti|Igbo-Eze North|Igbo-Eze South|Isi-Uzo|Nkanu East|Nkanu West|Nsukka|Oji River|Udenu|Udi|Uzo-Uwani'),
('FCT','Abaji|Bwari|Gwagwalada|Kuje|Kwali|Municipal Area Council'),
('Gombe','Akko|Balanga|Billiri|Dukku|Funakaye|Gombe|Kaltungo|Kwami|Nafada|Shongom|Yamaltu/Deba'),
('Imo','Aboh Mbaise|Ahiazu Mbaise|Ehime Mbano|Ezinihitte Mbaise|Ideato North|Ideato South|Ihitte/Uboma|Ikeduru|Isiala Mbano|Isu|Mbaitoli|Ngor-Okpala|Njaba|Nkwerre|Nwangele|Obowo|Oguta|Ohaji/Egbema|Okigwe|Onuimo|Orlu|Orsu|Oru East|Oru West|Owerri Municipal|Owerri North|Owerri West'),
('Jigawa','Auyo|Babura|Biriniwa|Birnin-Kudu|Buji|Dutse|Gagarawa|Garki|Gumel|Guri|Gwaram|Gwiwa|Hadejia|Jahun|Kafin Hausa|Kaugama|Kazaure|Kiri Kasama|Kiyawa|Maigatari|Malam Madori|Miga|Ringim|Roni|Sule Tankarkar|Taura|Yankwashi'),
('Kaduna','Birnin Gwari|Chikun|Giwa|Igabi|Ikara|Jaba|Jema''a|Kachia|Kaduna North|Kaduna South|Kagarko|Kajuru|Kaura|Kauru|Kubau|Kudan|Lere|Makarfi|Sabon Gari|Sanga|Soba|Zangon Kataf|Zaria'),
('Kano','Ajingi|Albasu|Bagwai|Bebeji|Bichi|Bunkure|Dala|Dambatta|Dawakin Kudu|Dawakin Tofa|Doguwa|Fagge|Gabasawa|Garko|Garun Mallam|Gaya|Gezawa|Gwale|Gwarzo|Kabo|Kano Municipal|Karaye|Kibiya|Kiru|Kumbotso|Kunchi|Kura|Madobi|Makoda|Minjibir|Nasarawa|Rano|Rimin Gado|Rogo|Shanono|Sumaila|Takai|Tarauni|Tofa|Tsanyawa|Tudun Wada|Ungogo|Warawa|Wudil'),
('Katsina','Bakori|Batagarawa|Batsari|Baure|Bindawa|Charanchi|Dandume|Danja|Dan Musa|Daura|Dutsi|Dutsin-Ma|Faskari|Funtua|Ingawa|Jibia|Kafur|Kaita|Kankara|Kankia|Katsina|Kurfi|Kusada|Mai''Adua|Malumfashi|Mani|Mashi|Matazu|Musawa|Rimi|Sabuwa|Safana|Sandamu|Zango'),
('Kebbi','Aleiro|Arewa Dandi|Argungu|Augie|Bagudo|Birnin Kebbi|Bunza|Dandi|Fakai|Gwandu|Jega|Kalgo|Koko/Besse|Maiyama|Ngaski|Sakaba|Shanga|Suru|Wasagu/Danko|Yauri|Zuru'),
('Kogi','Adavi|Ajaokuta|Ankpa|Bassa|Dekina|Ibaji|Idah|Igalamela-Odolu|Ijumu|Kabba/Bunu|Kogi|Lokoja|Mopa-Muro|Ofu|Ogori/Magongo|Okehi|Okene|Olamaboro|Omala|Yagba East|Yagba West'),
('Kwara','Asa|Baruten|Edu|Ekiti|Ifelodun|Ilorin East|Ilorin South|Ilorin West|Irepodun|Isin|Kaiama|Moro|Offa|Oke Ero|Oyun|Pategi'),
('Lagos','Agege|Ajeromi-Ifelodun|Alimosho|Amuwo-Odofin|Apapa|Badagry|Epe|Eti-Osa|Ibeju-Lekki|Ifako-Ijaiye|Ikeja|Ikorodu|Kosofe|Lagos Island|Lagos Mainland|Mushin|Ojo|Oshodi-Isolo|Shomolu|Surulere'),
('Nasarawa','Akwanga|Awe|Doma|Karu|Keana|Keffi|Kokona|Lafia|Nasarawa|Nasarawa Eggon|Obi|Toto|Wamba'),
('Niger','Agaie|Agwara|Bida|Borgu|Bosso|Chanchaga|Edati|Gbako|Gurara|Katcha|Kontagora|Lapai|Lavun|Magama|Mariga|Mashegu|Mokwa|Munya|Paikoro|Rafi|Rijau|Shiroro|Suleja|Tafa|Wushishi'),
('Ogun','Abeokuta North|Abeokuta South|Ado-Odo/Ota|Ewekoro|Ifo|Ijebu East|Ijebu North|Ijebu North East|Ijebu Ode|Ikenne|Imeko Afon|Ipokia|Obafemi-Owode|Odeda|Odogbolu|Ogun Waterside|Remo North|Sagamu|Yewa North|Yewa South'),
('Ondo','Akoko North-East|Akoko North-West|Akoko South-East|Akoko South-West|Akure North|Akure South|Ese-Odo|Idanre|Ifedore|Ilaje|Ile-Oluji/Okeigbo|Irele|Odigbo|Okitipupa|Ondo East|Ondo West|Ose|Owo'),
('Osun','Aiyedaade|Aiyedire|Atakumosa East|Atakumosa West|Boluwaduro|Boripe|Ede North|Ede South|Egbedore|Ejigbo|Ife Central|Ife East|Ife North|Ife South|Ifedayo|Ifelodun|Ila|Ilesa East|Ilesa West|Irepodun|Irewole|Isokan|Iwo|Obokun|Odo-Otin|Ola Oluwa|Olorunda|Oriade|Orolu|Osogbo'),
('Oyo','Afijio|Akinyele|Atiba|Atisbo|Egbeda|Ibadan North|Ibadan North-East|Ibadan North-West|Ibadan South-East|Ibadan South-West|Ibarapa Central|Ibarapa East|Ibarapa North|Ido|Irepo|Iseyin|Itesiwaju|Iwajowa|Kajola|Lagelu|Ogbomosho North|Ogbomosho South|Ogo Oluwa|Oluyole|Ona Ara|Orelope|Ori Ire|Oyo East|Oyo West|Saki East|Saki West|Surulere'),
('Plateau','Barkin Ladi|Bassa|Bokkos|Jos East|Jos North|Jos South|Kanam|Kanke|Langtang North|Langtang South|Mangu|Mikang|Pankshin|Qua''an Pan|Riyom|Shendam|Wase'),
('Rivers','Abua/Odual|Ahoada East|Ahoada West|Akuku-Toru|Andoni|Asari-Toru|Bonny|Degema|Eleme|Emuoha|Etche|Gokana|Ikwerre|Khana|Obio/Akpor|Ogba/Egbema/Ndoni|Ogu/Bolo|Okrika|Omuma|Opobo/Nkoro|Oyigbo|Port Harcourt|Tai'),
('Sokoto','Binji|Bodinga|Dange-Shuni|Gada|Goronyo|Gudu|Gwadabawa|Illela|Isa|Kebbe|Kware|Rabah|Sabon Birni|Shagari|Silame|Sokoto North|Sokoto South|Tambuwal|Tangaza|Tureta|Wamako|Wurno|Yabo'),
('Taraba','Ardo Kola|Bali|Donga|Gashaka|Gassol|Ibi|Jalingo|Karim Lamido|Kumi|Lau|Sardauna|Takum|Ussa|Wukari|Yorro|Zing'),
('Yobe','Bade|Bursari|Damaturu|Fika|Fune|Geidam|Gujba|Gulani|Jakusko|Karasuwa|Machina|Nangere|Nguru|Potiskum|Tarmuwa|Yunusari|Yusufari'),
('Zamfara','Anka|Bakura|Birnin Magaji/Kiyaw|Bukkuyum|Bungudu|Gummi|Gusau|Kaura Namoda|Maradun|Maru|Shinkafi|Talata Mafara|Tsafe|Zurmi')
) AS s(state, lgas)
CROSS JOIN LATERAL unnest(string_to_array(s.lgas, '|')) AS l
ON CONFLICT DO NOTHING;

INSERT INTO public.mu_lga_index (state, lga)
SELECT 'Abuja', lga FROM public.mu_lga_index WHERE state = 'FCT'
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS mu_lga_index_key_idx ON public.mu_lga_index (public.mu_loc_key(lga));

CREATE OR REPLACE FUNCTION public.mu_lga_states(_lga text)
RETURNS text[] LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT coalesce(array_agg(DISTINCT state ORDER BY state), '{}')
  FROM public.mu_lga_index
  WHERE public.mu_loc_key(lga) = public.mu_loc_key(_lga);
$$;

CREATE OR REPLACE FUNCTION public.mu_query_field(_person_id uuid, _field text, _value text, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.mu_parsed_fields
    (person_id, field, value, confidence, model, status, evidence, note)
  VALUES (_person_id, _field, _value, 0, 'shape_check', 'queried',
          'Held on the profile as: ' || coalesce(_value,''), _note)
  ON CONFLICT (person_id, field) DO UPDATE
    SET status = 'queried',
        note = EXCLUDED.note,
        value = coalesce(public.mu_parsed_fields.value, EXCLUDED.value),
        updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.mu_flag_profile_ambiguity(_person_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  fld text; val text; problem text; n int := 0;
  st text; lg text; known text[];
BEGIN
  FOREACH fld IN ARRAY ARRAY['state','lga','profession','licensing_body'] LOOP
    EXECUTE format('SELECT %I::text FROM public.mu_people WHERE id = $1', fld)
      INTO val USING _person_id;
    CONTINUE WHEN val IS NULL OR btrim(val) = '';
    problem := public.mu_field_shape_problem(fld, val);
    CONTINUE WHEN problem IS NULL;
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.mu_parsed_fields
       WHERE person_id = _person_id AND field = fld
         AND status IN ('queried','candidate_updated'));
    PERFORM public.mu_query_field(_person_id, fld, val, problem);
    n := n + 1;
  END LOOP;

  SELECT state, lga INTO st, lg FROM public.mu_people WHERE id = _person_id;
  IF lg IS NOT NULL AND btrim(lg) <> '' AND public.mu_field_shape_problem('lga', lg) IS NULL THEN
    known := public.mu_lga_states(lg);
    IF cardinality(known) = 0 THEN
      IF NOT EXISTS (SELECT 1 FROM public.mu_parsed_fields WHERE person_id = _person_id AND field = 'lga' AND status IN ('queried','candidate_updated')) THEN
        PERFORM public.mu_query_field(_person_id, 'lga', lg,
          'We could not match this to a Nigerian local government area. Please pick yours.');
        n := n + 1;
      END IF;
    ELSIF st IS NOT NULL AND btrim(st) <> ''
      AND NOT EXISTS (SELECT 1 FROM unnest(known) k WHERE public.mu_loc_key(k) = public.mu_loc_key(st)) THEN
      PERFORM public.mu_query_field(_person_id, 'lga', lg,
        lg || ' is in ' || array_to_string(known, ' or ') || ', but your profile says ' || st || '. Please confirm where you live.');
      PERFORM public.mu_query_field(_person_id, 'state', st,
        'Your area (' || lg || ') is in ' || array_to_string(known, ' or ') || '. Please confirm the state you live in.');
      n := n + 2;
    END IF;
  END IF;

  RETURN n;
END;
$$;